/**
 * UniversalPOS Pre-Flight Hardening Checklist
 * Complete verification of all hardening requirements
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
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
                        raw: data
                    });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log('   UniversalPOS PRE-FLIGHT HARDENING CHECKLIST');
console.log('   Date: ' + new Date().toISOString());
console.log('═══════════════════════════════════════════════════════════════════\n');

const results = { pass: 0, fail: 0, sections: {} };

function check(section, name, condition, details = '') {
    if (!results.sections[section]) results.sections[section] = [];
    const status = condition ? 'PASS' : 'FAIL';
    if (condition) results.pass++; else results.fail++;
    results.sections[section].push({ name, status, details });
    console.log(`   ${condition ? '✅' : '❌'} ${name}${details ? ': ' + details : ''}`);
}

async function runPreFlight() {
    // =========================================================================
    // A) ONE-SERVER CERTAINTY
    // =========================================================================
    console.log('\n📋 A) ONE-SERVER CERTAINTY\n');
    
    const health = await request('GET', '/api/health');
    check('A', 'Health endpoint returns OK', health.status === 200 && health.body.status === 'OK');
    
    const buildInfo = await request('GET', '/build/info');
    check('A', 'Build info returns 200', buildInfo.status === 200);
    check('A', 'Build info has hardenedVersion', buildInfo.body.hardenedVersion === '2.0.0', buildInfo.body.hardenedVersion);
    check('A', 'Build info has moneyFormat=integer_cents', buildInfo.body.moneyFormat === 'integer_cents');
    check('A', 'Build info has historyPattern=append_only', buildInfo.body.historyPattern === 'append_only');
    check('A', 'Server port is 5000', buildInfo.body.port === 5000);
    
    // =========================================================================
    // C) MONEY SAFETY
    // =========================================================================
    console.log('\n📋 C) MONEY SAFETY (No Floats, Server Calculates Totals)\n');
    
    // Find available table
    const tables = await request('GET', '/restaurant/tables');
    let tableId = tables.body.find(t => t.status === 'available')?.id;
    if (!tableId) {
        // Clean up a table
        tableId = 1;
        await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'available', userId: 'admin' });
    }
    
    // Seat and create order
    const seatKey = `preflight-seat-${Date.now()}`;
    const seat = await request('POST', `/restaurant/tables/${tableId}/seat`, 
        { userId: 'admin', guestCount: 2 },
        { 'Idempotency-Key': seatKey }
    );
    check('C', 'Seat request succeeds', seat.status === 200);
    const orderId = seat.body.orderId;
    console.log(`      Order ID: ${orderId}`);
    
    // Send to kitchen
    const kitchenKey = `preflight-kitchen-${Date.now()}`;
    await request('POST', '/restaurant/kitchen/send', 
        { orderId, items: [{ productId: 1, productName: 'Burger', quantity: 2 }], userId: 'admin' },
        { 'Idempotency-Key': kitchenKey }
    );
    
    // Generate bill
    const bill = await request('POST', `/orders/${orderId}/bill`, { userId: 'admin' });
    check('C', 'Bill has subtotalCents (integer)', typeof bill.body.subtotalCents === 'number');
    check('C', 'Bill has taxAmountCents (integer)', typeof bill.body.taxAmountCents === 'number');
    check('C', 'Bill has totalAmountCents (integer)', typeof bill.body.totalAmountCents === 'number');
    
    const calcTotal = (bill.body.subtotalCents || 0) + (bill.body.taxAmountCents || 0) + (bill.body.serviceCents || 0) - (bill.body.discountCents || 0);
    check('C', 'Total = subtotal + tax + service - discount', 
        bill.body.totalAmountCents === calcTotal,
        `${bill.body.totalAmountCents} = ${calcTotal}`
    );
    
    console.log(`      Bill breakdown: subtotal=${bill.body.subtotalCents}¢ + tax=${bill.body.taxAmountCents}¢ = total=${bill.body.totalAmountCents}¢`);
    
    // Test payment with client-sent amount mismatch
    const mismatchKey = `preflight-pay-mismatch-${Date.now()}`;
    const mismatchPay = await request('POST', '/payments',
        { orderId, method: 'cash', amountCents: 1 }, // Wrong amount
        { 'Idempotency-Key': mismatchKey }
    );
    check('C', 'Payment with wrong amountCents returns 409', 
        mismatchPay.status === 409,
        `status=${mismatchPay.status}`
    );
    
    // =========================================================================
    // D) IDEMPOTENCY
    // =========================================================================
    console.log('\n📋 D) IDEMPOTENCY (Replay Safe, Race Safe)\n');
    
    // First payment
    const payKey = `preflight-pay-${Date.now()}`;
    const pay1 = await request('POST', '/payments',
        { orderId, method: 'cash' },
        { 'Idempotency-Key': payKey }
    );
    check('D', 'First payment succeeds', pay1.status === 200);
    const paymentId = pay1.body.id;
    console.log(`      Payment ID: ${paymentId}`);
    
    // Replay same request (same key, same body)
    const pay2 = await request('POST', '/payments',
        { orderId, method: 'cash' },
        { 'Idempotency-Key': payKey }
    );
    check('D', 'Replay returns same payment ID', pay2.body.id === paymentId, `${pay2.body.id} === ${paymentId}`);
    check('D', 'Replay returns 200 (not duplicate)', pay2.status === 200);
    
    // Same key, different body (should return 409)
    const pay3 = await request('POST', '/payments',
        { orderId, method: 'card' }, // Different method
        { 'Idempotency-Key': payKey }
    );
    check('D', 'Different body with same key returns 409', pay3.status === 409);
    
    // Close order
    await request('POST', `/orders/${orderId}/close`, { userId: 'admin' });
    await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'needs_cleaning', userId: 'admin' });
    await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'available', userId: 'admin' });
    
    // =========================================================================
    // E) CONCURRENCY SAFETY
    // =========================================================================
    console.log('\n📋 E) CONCURRENCY SAFETY (Double-Seat / Double-Pay)\n');
    
    // Double-seat test
    const tables2 = await request('GET', '/restaurant/tables');
    let raceTableId = tables2.body.find(t => t.status === 'available')?.id || 1;
    
    const raceKey1 = `race-seat-${Date.now()}-A`;
    const raceKey2 = `race-seat-${Date.now()}-B`;
    
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
    
    console.log(`      Race A: ${race1.status}, Race B: ${race2.status}`);
    const raceStatuses = [race1.status, race2.status].sort();
    check('E', 'Double-seat: one success (200), one rejected (409)', 
        raceStatuses[0] === 200 && raceStatuses[1] === 409,
        `[${raceStatuses.join(', ')}]`
    );
    
    // Cleanup race winner
    const raceWinner = race1.status === 200 ? race1 : race2;
    if (raceWinner.body.orderId) {
        await request('POST', '/restaurant/kitchen/send', { orderId: raceWinner.body.orderId, items: [{ productId: 1, productName: 'Test', quantity: 1 }], userId: 'admin' });
        await request('POST', `/orders/${raceWinner.body.orderId}/bill`, { userId: 'admin' });
        await request('POST', '/payments', { orderId: raceWinner.body.orderId, method: 'cash' });
        await request('POST', `/orders/${raceWinner.body.orderId}/close`, { userId: 'admin' });
        await request('POST', `/restaurant/tables/${raceTableId}/status`, { status: 'needs_cleaning', userId: 'admin' });
        await request('POST', `/restaurant/tables/${raceTableId}/status`, { status: 'available', userId: 'admin' });
    }
    
    // Double-pay test
    const tables3 = await request('GET', '/restaurant/tables');
    let payRaceTableId = tables3.body.find(t => t.status === 'available')?.id || 2;
    
    const payRaceSeat = await request('POST', `/restaurant/tables/${payRaceTableId}/seat`,
        { userId: 'admin', guestCount: 2 },
        { 'Idempotency-Key': `payrace-setup-${Date.now()}` }
    );
    const payRaceOrderId = payRaceSeat.body.orderId;
    
    await request('POST', '/restaurant/kitchen/send', 
        { orderId: payRaceOrderId, items: [{ productId: 1, productName: 'Burger', quantity: 1 }], userId: 'admin' }
    );
    await request('POST', `/orders/${payRaceOrderId}/bill`, { userId: 'admin' });
    
    const payRaceKey1 = `pay-race-${Date.now()}-A`;
    const payRaceKey2 = `pay-race-${Date.now()}-B`;
    
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
    
    console.log(`      Pay Race A: ${payRace1.status}, Pay Race B: ${payRace2.status}`);
    const payRaceStatuses = [payRace1.status, payRace2.status].sort();
    check('E', 'Double-pay: one success (200), one rejected (409)', 
        payRaceStatuses[0] === 200 && payRaceStatuses[1] === 409,
        `[${payRaceStatuses.join(', ')}]`
    );
    
    // Cleanup
    await request('POST', `/orders/${payRaceOrderId}/close`, { userId: 'admin' });
    await request('POST', `/restaurant/tables/${payRaceTableId}/status`, { status: 'needs_cleaning', userId: 'admin' });
    await request('POST', `/restaurant/tables/${payRaceTableId}/status`, { status: 'available', userId: 'admin' });
    
    // =========================================================================
    // G) UI/API CONTRACT STABILITY
    // =========================================================================
    console.log('\n📋 G) UI/API CONTRACT STABILITY\n');
    
    const kitchenQueue = await request('GET', '/restaurant/kitchen/queue');
    check('G', 'Kitchen queue returns array', Array.isArray(kitchenQueue.body));
    
    if (kitchenQueue.body.length > 0) {
        const item = kitchenQueue.body[0];
        check('G', 'Kitchen item has ticketItemId', item.ticketItemId !== undefined);
        check('G', 'Kitchen item has orderId', item.orderId !== undefined);
        check('G', 'Kitchen item has orderNumber', item.orderNumber !== undefined);
        check('G', 'Kitchen item has productName', item.productName !== undefined);
        check('G', 'Kitchen item has tableLabel or tableId', item.tableLabel !== undefined || item.tableId !== undefined);
        console.log(`      Sample item: Order ${item.orderNumber} (${item.tableLabel || 'Table ' + item.tableId}) - ${item.productName}`);
    } else {
        console.log('      No kitchen items to test (queue empty)');
    }
    
    // Check tables endpoint
    const tablesCheck = await request('GET', '/restaurant/tables');
    check('G', 'Tables returns array', Array.isArray(tablesCheck.body));
    if (tablesCheck.body.length > 0) {
        const t = tablesCheck.body[0];
        check('G', 'Table has id', t.id !== undefined);
        check('G', 'Table has name', t.name !== undefined);
        check('G', 'Table has status', t.status !== undefined);
    }
    
    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log(`   RESULTS: ${results.pass} PASS, ${results.fail} FAIL`);
    console.log('═══════════════════════════════════════════════════════════════════');
    
    if (results.fail === 0) {
        console.log('\n✅ ALL PRE-FLIGHT CHECKS PASSED - Ready for new module work!\n');
    } else {
        console.log('\n❌ SOME CHECKS FAILED - Review and fix before proceeding\n');
        for (const [section, checks] of Object.entries(results.sections)) {
            const failures = checks.filter(c => c.status === 'FAIL');
            if (failures.length > 0) {
                console.log(`   Section ${section} failures:`);
                failures.forEach(f => console.log(`      - ${f.name}: ${f.details}`));
            }
        }
    }
    
    process.exit(results.fail > 0 ? 1 : 0);
}

runPreFlight().catch(err => {
    console.error('Pre-flight error:', err);
    process.exit(1);
});
