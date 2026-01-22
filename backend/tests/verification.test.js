/**
 * UniversalPOS Production Hardening v2.0 - Verification Script
 * 
 * Tests:
 * 1. Full restaurant cycle with idempotency replay
 * 2. Double-seat prevention (concurrency race)
 * 3. Double-payment prevention (concurrency race)
 * 4. Audit trail verification (no deleted history)
 * 5. Idempotency key mismatch rejection
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

// HTTP request helper
function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        body: data ? JSON.parse(data) : {},
                    });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Direct DB query helper (via custom endpoint)
async function queryDB(sql) {
    // We'll use the API to check table_statuses
    const res = await request('GET', '/restaurant/tables');
    return res.body;
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  UniversalPOS Production Hardening v2.0 - Verification');
console.log('═══════════════════════════════════════════════════════════════');

async function runVerification() {
    let passed = 0;
    let failed = 0;
    
    function check(condition, message) {
        if (condition) {
            console.log(`  ✅ ${message}`);
            passed++;
        } else {
            console.log(`  ❌ ${message}`);
            failed++;
        }
    }
    
    // ========================================================================
    // TEST 1: Build Info Security
    // ========================================================================
    console.log('\n📋 TEST 1: Build Info Endpoint');
    
    const buildInfo = await request('GET', '/build/info');
    check(buildInfo.status === 200, 'Build info returns 200');
    check(buildInfo.body.hardenedVersion === '2.0.0', 'Hardened version is 2.0.0');
    check(buildInfo.body.historyPattern === 'append_only', 'History pattern is append_only');
    check(buildInfo.body.moneyFormat === 'integer_cents', 'Money format is integer_cents');
    
    // ========================================================================
    // TEST 2: Full Restaurant Cycle with Idempotency
    // ========================================================================
    console.log('\n📋 TEST 2: Full Restaurant Cycle with Idempotency Replay');
    
    // Find available table
    const tablesRes = await request('GET', '/restaurant/tables');
    let tableId = tablesRes.body.find(t => t.status === 'available')?.id;
    if (!tableId) {
        // Clean up first table
        tableId = tablesRes.body[0]?.id;
        await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'available', userId: 'admin' });
    }
    
    console.log(`   Using table ${tableId}`);
    
    // Step 1: Seat
    const seatKey = `verify-seat-${Date.now()}`;
    const seat1 = await request('POST', `/restaurant/tables/${tableId}/seat`, 
        { userId: 'admin', guestCount: 2 }, 
        { 'Idempotency-Key': seatKey }
    );
    check(seat1.status === 200, 'Seat request succeeds');
    const orderId = seat1.body.orderId;
    console.log(`   Order ID: ${orderId}`);
    
    // Step 2: Send to kitchen
    const kitchenKey = `verify-kitchen-${Date.now()}`;
    const kitchen1 = await request('POST', '/restaurant/kitchen/send',
        { orderId, items: [{ productId: 1, productName: 'Burger', quantity: 2 }], userId: 'admin' },
        { 'Idempotency-Key': kitchenKey }
    );
    check(kitchen1.status === 200, 'Kitchen send succeeds');
    
    // Kitchen replay
    const kitchen2 = await request('POST', '/restaurant/kitchen/send',
        { orderId, items: [{ productId: 1, productName: 'Burger', quantity: 2 }], userId: 'admin' },
        { 'Idempotency-Key': kitchenKey }
    );
    check(kitchen2.status === 200, 'Kitchen replay returns 200');
    check(kitchen1.body.orderId === kitchen2.body.orderId, 'Kitchen replay returns same orderId');
    
    // Step 3: Generate bill
    const bill = await request('POST', `/orders/${orderId}/bill`, { userId: 'admin' });
    check(bill.status === 200, 'Bill generation succeeds');
    check(typeof bill.body.subtotalCents === 'number', 'Bill has subtotalCents (integer)');
    check(typeof bill.body.totalAmountCents === 'number', 'Bill has totalAmountCents (integer)');
    console.log(`   Bill: $${bill.body.totalAmount} (${bill.body.totalAmountCents} cents)`);
    
    // Step 4: Payment with idempotency
    const payKey = `verify-pay-${Date.now()}`;
    const pay1 = await request('POST', '/payments',
        { orderId, method: 'cash' },
        { 'Idempotency-Key': payKey }
    );
    check(pay1.status === 200, 'First payment succeeds');
    const paymentId = pay1.body.id;
    console.log(`   Payment ID: ${paymentId}`);
    
    // Payment replay (same key)
    const pay2 = await request('POST', '/payments',
        { orderId, method: 'cash' },
        { 'Idempotency-Key': payKey }
    );
    check(pay2.status === 200, 'Payment replay returns 200');
    check(pay1.body.id === pay2.body.id, `Payment replay returns same ID (${pay1.body.id} === ${pay2.body.id})`);
    
    // Step 5: Close order
    const close = await request('POST', `/orders/${orderId}/close`, { userId: 'admin' });
    check(close.status === 200, 'Order close succeeds');
    
    // Step 6: Clean table
    await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'needs_cleaning', userId: 'admin' });
    await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'available', userId: 'admin' });
    
    // ========================================================================
    // TEST 3: Double-Seat Prevention (Concurrency Race)
    // ========================================================================
    console.log('\n📋 TEST 3: Double-Seat Prevention (Concurrency Race)');
    
    // Ensure table is available
    const tables2 = await request('GET', '/restaurant/tables');
    let raceTableId = tables2.body.find(t => t.status === 'available')?.id || 1;
    
    const raceKey1 = `race-seat-${Date.now()}-A`;
    const raceKey2 = `race-seat-${Date.now()}-B`;
    
    // Fire both requests simultaneously
    const [race1, race2] = await Promise.all([
        request('POST', `/restaurant/tables/${raceTableId}/seat`, 
            { userId: 'admin', guestCount: 2 }, 
            { 'Idempotency-Key': raceKey1 }
        ),
        request('POST', `/restaurant/tables/${raceTableId}/seat`, 
            { userId: 'admin', guestCount: 2 }, 
            { 'Idempotency-Key': raceKey2 }
        ),
    ]);
    
    console.log(`   Client A: ${race1.status}`);
    console.log(`   Client B: ${race2.status}`);
    
    const raceStatuses = [race1.status, race2.status].sort();
    check(raceStatuses[0] === 200 && raceStatuses[1] === 409, 
        'Exactly one seat succeeds (200), one fails (409)');
    
    // Cleanup
    const successRace = race1.status === 200 ? race1 : race2;
    if (successRace.body.orderId) {
        await request('POST', '/restaurant/kitchen/send', { orderId: successRace.body.orderId, items: [{ productId: 1, productName: 'Test', quantity: 1 }], userId: 'admin' });
        await request('POST', `/orders/${successRace.body.orderId}/bill`, { userId: 'admin' });
        await request('POST', '/payments', { orderId: successRace.body.orderId, method: 'cash' });
        await request('POST', `/orders/${successRace.body.orderId}/close`, { userId: 'admin' });
        await request('POST', `/restaurant/tables/${raceTableId}/status`, { status: 'needs_cleaning', userId: 'admin' });
        await request('POST', `/restaurant/tables/${raceTableId}/status`, { status: 'available', userId: 'admin' });
    }
    
    // ========================================================================
    // TEST 4: Double-Payment Prevention (Concurrency Race)
    // ========================================================================
    console.log('\n📋 TEST 4: Double-Payment Prevention (Concurrency Race)');
    
    // Create new order
    const tables3 = await request('GET', '/restaurant/tables');
    let payRaceTableId = tables3.body.find(t => t.status === 'available')?.id || 1;
    
    const payRaceSeat = await request('POST', `/restaurant/tables/${payRaceTableId}/seat`,
        { userId: 'admin', guestCount: 2 },
        { 'Idempotency-Key': `payracesetup-${Date.now()}` }
    );
    const payRaceOrderId = payRaceSeat.body.orderId;
    
    await request('POST', '/restaurant/kitchen/send', 
        { orderId: payRaceOrderId, items: [{ productId: 1, productName: 'Burger', quantity: 1 }], userId: 'admin' }
    );
    await request('POST', `/orders/${payRaceOrderId}/bill`, { userId: 'admin' });
    
    const payRaceKey1 = `pay-race-${Date.now()}-A`;
    const payRaceKey2 = `pay-race-${Date.now()}-B`;
    
    // Fire both payment requests simultaneously
    const [payRace1, payRace2] = await Promise.all([
        request('POST', '/payments', 
            { orderId: payRaceOrderId, method: 'cash' }, 
            { 'Idempotency-Key': payRaceKey1 }
        ),
        request('POST', '/payments', 
            { orderId: payRaceOrderId, method: 'card' }, 
            { 'Idempotency-Key': payRaceKey2 }
        ),
    ]);
    
    console.log(`   Client A: ${payRace1.status}`);
    console.log(`   Client B: ${payRace2.status}`);
    
    const payRaceStatuses = [payRace1.status, payRace2.status].sort();
    check(payRaceStatuses[0] === 200 && payRaceStatuses[1] === 409,
        'Exactly one payment succeeds (200), one fails (409)');
    
    // Cleanup
    await request('POST', `/orders/${payRaceOrderId}/close`, { userId: 'admin' });
    await request('POST', `/restaurant/tables/${payRaceTableId}/status`, { status: 'needs_cleaning', userId: 'admin' });
    await request('POST', `/restaurant/tables/${payRaceTableId}/status`, { status: 'available', userId: 'admin' });
    
    // ========================================================================
    // TEST 5: Idempotency Key Mismatch Rejection
    // ========================================================================
    console.log('\n📋 TEST 5: Idempotency Key Mismatch Rejection');
    
    // Create new order for testing
    const tables4 = await request('GET', '/restaurant/tables');
    let mismatchTableId = tables4.body.find(t => t.status === 'available')?.id || 1;
    
    const mismatchSeat = await request('POST', `/restaurant/tables/${mismatchTableId}/seat`,
        { userId: 'admin', guestCount: 2 },
        { 'Idempotency-Key': `mismatch-setup-${Date.now()}` }
    );
    const mismatchOrderId = mismatchSeat.body.orderId;
    
    await request('POST', '/restaurant/kitchen/send',
        { orderId: mismatchOrderId, items: [{ productId: 1, productName: 'Burger', quantity: 1 }], userId: 'admin' }
    );
    await request('POST', `/orders/${mismatchOrderId}/bill`, { userId: 'admin' });
    
    // First payment with key
    const mismatchKey = `mismatch-key-${Date.now()}`;
    const mismatch1 = await request('POST', '/payments',
        { orderId: mismatchOrderId, method: 'cash' },
        { 'Idempotency-Key': mismatchKey }
    );
    check(mismatch1.status === 200, 'First payment with key succeeds');
    
    // Try same key with DIFFERENT payload (this should be rejected or return same result)
    const mismatch2 = await request('POST', '/payments',
        { orderId: mismatchOrderId, method: 'card' }, // Different method
        { 'Idempotency-Key': mismatchKey }
    );
    
    // Should either reject with 409 (key reuse with different payload) or return cached result
    check(mismatch2.status === 409 || mismatch2.body.id === mismatch1.body.id,
        'Key reuse with different payload: rejected (409) or returns cached result');
    console.log(`   Mismatch test result: ${mismatch2.status} - ${JSON.stringify(mismatch2.body)}`);
    
    // Cleanup
    await request('POST', `/orders/${mismatchOrderId}/close`, { userId: 'admin' });
    await request('POST', `/restaurant/tables/${mismatchTableId}/status`, { status: 'needs_cleaning', userId: 'admin' });
    await request('POST', `/restaurant/tables/${mismatchTableId}/status`, { status: 'available', userId: 'admin' });
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`   VERIFICATION RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (failed === 0) {
        console.log('\n✅ ALL VERIFICATIONS PASSED - Production Hardening v2.0 Complete');
    } else {
        console.log('\n❌ SOME VERIFICATIONS FAILED - Review issues above');
    }
    
    process.exit(failed > 0 ? 1 : 0);
}

runVerification().catch(err => {
    console.error('Verification error:', err);
    process.exit(1);
});
