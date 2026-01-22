/**
 * Concurrency Tests for UniversalPOS Production Hardening
 * 
 * These tests verify:
 * 1. Two clients cannot seat the same table simultaneously
 * 2. Two clients cannot pay the same order simultaneously
 * 3. Idempotency retry tests for payment and kitchen submit
 * 
 * Run with: node tests/concurrency.test.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

// Helper to make HTTP requests
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

// Test result tracking
let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ ${message}`);
        passed++;
    } else {
        console.log(`  ❌ ${message}`);
        failed++;
    }
}

// ============================================================================
// TEST 1: Double-Seat Prevention
// ============================================================================
async function testDoubleSeatPrevention() {
    console.log('\n🔒 TEST 1: Double-Seat Prevention');
    console.log('   Two clients try to seat the same table simultaneously');
    
    // First, find an available table
    const tablesRes = await request('GET', '/restaurant/tables');
    const availableTable = tablesRes.body.find(t => t.status === 'available');
    
    if (!availableTable) {
        console.log('   ⚠️  No available tables found. Creating test scenario...');
        // Clean a table first
        const anyTable = tablesRes.body[0];
        if (anyTable) {
            await request('POST', `/restaurant/tables/${anyTable.id}/status`, {
                status: 'available',
                userId: 'admin',
            });
        }
    }
    
    const tableId = availableTable?.id || tablesRes.body[0]?.id;
    if (!tableId) {
        console.log('   ❌ No tables available for test');
        failed++;
        return;
    }
    
    console.log(`   Using table ${tableId}`);
    
    // Ensure table is available
    await request('POST', `/restaurant/tables/${tableId}/status`, {
        status: 'available',
        userId: 'admin',
    });
    
    // Send two concurrent seat requests with different idempotency keys
    const key1 = `test-seat-${Date.now()}-client1`;
    const key2 = `test-seat-${Date.now()}-client2`;
    
    const [result1, result2] = await Promise.all([
        request('POST', `/restaurant/tables/${tableId}/seat`, {
            userId: 'admin',
            guestCount: 2,
        }, { 'Idempotency-Key': key1 }),
        request('POST', `/restaurant/tables/${tableId}/seat`, {
            userId: 'admin',
            guestCount: 2,
        }, { 'Idempotency-Key': key2 }),
    ]);
    
    console.log(`   Client 1: ${result1.status} - ${JSON.stringify(result1.body)}`);
    console.log(`   Client 2: ${result2.status} - ${JSON.stringify(result2.body)}`);
    
    // Exactly one should succeed (200), one should fail (409)
    const statuses = [result1.status, result2.status].sort();
    assert(
        statuses.includes(200) && statuses.includes(409),
        'Exactly one seat request succeeds, one fails with 409'
    );
    
    // Clean up - close order if one was created
    const successResult = result1.status === 200 ? result1 : result2;
    if (successResult.body.orderId) {
        // Bill and pay the order to clean up
        await request('POST', '/restaurant/kitchen/send', {
            orderId: successResult.body.orderId,
            items: [{ productId: 1, productName: 'Test', quantity: 1 }],
            userId: 'admin',
        });
        await request('POST', `/orders/${successResult.body.orderId}/bill`, { userId: 'admin' });
        await request('POST', '/payments', {
            orderId: successResult.body.orderId,
            method: 'cash',
        });
        await request('POST', `/orders/${successResult.body.orderId}/close`, { userId: 'admin' });
        // Follow state machine: billed -> needs_cleaning -> available
        await request('POST', `/restaurant/tables/${tableId}/status`, {
            status: 'needs_cleaning',
            userId: 'admin',
        });
        await request('POST', `/restaurant/tables/${tableId}/status`, {
            status: 'available',
            userId: 'admin',
        });
    }
}

// ============================================================================
// TEST 2: Double-Payment Prevention
// ============================================================================
async function testDoublePaymentPrevention() {
    console.log('\n🔒 TEST 2: Double-Payment Prevention');
    console.log('   Two clients try to pay the same order simultaneously');
    
    // Create a new order
    const tablesRes = await request('GET', '/restaurant/tables');
    let tableId = tablesRes.body.find(t => t.status === 'available')?.id;
    
    if (!tableId) {
        tableId = tablesRes.body[0]?.id;
        if (tableId) {
            await request('POST', `/restaurant/tables/${tableId}/status`, {
                status: 'available',
                userId: 'admin',
            });
        }
    }
    
    if (!tableId) {
        console.log('   ❌ No tables available for test');
        failed++;
        return;
    }
    
    // Seat the table
    const seatRes = await request('POST', `/restaurant/tables/${tableId}/seat`, {
        userId: 'admin',
        guestCount: 2,
    }, { 'Idempotency-Key': `test-seat-pay-${Date.now()}` });
    
    if (seatRes.status !== 200) {
        console.log(`   ❌ Failed to seat table: ${JSON.stringify(seatRes.body)}`);
        failed++;
        return;
    }
    
    const orderId = seatRes.body.orderId;
    console.log(`   Created order ${orderId}`);
    
    // Send items to kitchen
    await request('POST', '/restaurant/kitchen/send', {
        orderId,
        items: [{ productId: 1, productName: 'Burger', quantity: 1 }],
        userId: 'admin',
    });
    
    // Generate bill
    const billRes = await request('POST', `/orders/${orderId}/bill`, { userId: 'admin' });
    console.log(`   Bill: ${JSON.stringify(billRes.body)}`);
    
    // Send two concurrent payment requests with different idempotency keys
    const key1 = `test-pay-${Date.now()}-client1`;
    const key2 = `test-pay-${Date.now()}-client2`;
    
    const [pay1, pay2] = await Promise.all([
        request('POST', '/payments', {
            orderId,
            method: 'cash',
        }, { 'Idempotency-Key': key1 }),
        request('POST', '/payments', {
            orderId,
            method: 'card',
        }, { 'Idempotency-Key': key2 }),
    ]);
    
    console.log(`   Client 1: ${pay1.status} - ${JSON.stringify(pay1.body)}`);
    console.log(`   Client 2: ${pay2.status} - ${JSON.stringify(pay2.body)}`);
    
    // Exactly one should succeed (200), one should fail (409)
    const statuses = [pay1.status, pay2.status].sort();
    assert(
        statuses.includes(200) && statuses.includes(409),
        'Exactly one payment succeeds, one fails with 409'
    );
    
    // Clean up
    await request('POST', `/orders/${orderId}/close`, { userId: 'admin' });
    // Follow state machine: billed -> needs_cleaning -> available
    await request('POST', `/restaurant/tables/${tableId}/status`, {
        status: 'needs_cleaning',
        userId: 'admin',
    });
    await request('POST', `/restaurant/tables/${tableId}/status`, {
        status: 'available',
        userId: 'admin',
    });
}

// ============================================================================
// TEST 3: Idempotency Retry for Payment
// ============================================================================
async function testIdempotencyRetryPayment() {
    console.log('\n🔒 TEST 3: Idempotency Retry for Payment');
    console.log('   Same idempotency key should return same result');
    
    // Create a new order
    const tablesRes = await request('GET', '/restaurant/tables');
    let tableId = tablesRes.body.find(t => t.status === 'available')?.id;
    
    if (!tableId) {
        tableId = tablesRes.body[0]?.id;
        if (tableId) {
            await request('POST', `/restaurant/tables/${tableId}/status`, {
                status: 'available',
                userId: 'admin',
            });
        }
    }
    
    // Seat, send to kitchen, bill
    const seatRes = await request('POST', `/restaurant/tables/${tableId}/seat`, {
        userId: 'admin',
        guestCount: 2,
    }, { 'Idempotency-Key': `test-idemp-${Date.now()}` });
    
    const orderId = seatRes.body.orderId;
    
    await request('POST', '/restaurant/kitchen/send', {
        orderId,
        items: [{ productId: 1, productName: 'Burger', quantity: 1 }],
        userId: 'admin',
    });
    
    await request('POST', `/orders/${orderId}/bill`, { userId: 'admin' });
    
    // Send payment with idempotency key
    const idempKey = `test-idemp-pay-${Date.now()}`;
    
    const pay1 = await request('POST', '/payments', {
        orderId,
        method: 'cash',
    }, { 'Idempotency-Key': idempKey });
    
    console.log(`   First payment: ${pay1.status} - ${JSON.stringify(pay1.body)}`);
    
    // Retry with same key (simulating network retry)
    const pay2 = await request('POST', '/payments', {
        orderId,
        method: 'cash',
    }, { 'Idempotency-Key': idempKey });
    
    console.log(`   Retry payment: ${pay2.status} - ${JSON.stringify(pay2.body)}`);
    
    assert(pay1.status === 200, 'First payment succeeds');
    assert(pay2.status === 200, 'Retry returns same success status');
    assert(pay1.body.id === pay2.body.id, 'Same payment ID returned on retry');
    
    // Clean up
    await request('POST', `/orders/${orderId}/close`, { userId: 'admin' });
    // Follow state machine: billed -> needs_cleaning -> available
    await request('POST', `/restaurant/tables/${tableId}/status`, {
        status: 'needs_cleaning',
        userId: 'admin',
    });
    await request('POST', `/restaurant/tables/${tableId}/status`, {
        status: 'available',
        userId: 'admin',
    });
}

// ============================================================================
// TEST 4: Idempotency Retry for Kitchen Send
// ============================================================================
async function testIdempotencyRetryKitchen() {
    console.log('\n🔒 TEST 4: Idempotency Retry for Kitchen Send');
    console.log('   Same idempotency key should return same result');
    
    // Create a new order
    const tablesRes = await request('GET', '/restaurant/tables');
    let tableId = tablesRes.body.find(t => t.status === 'available')?.id;
    
    if (!tableId) {
        tableId = tablesRes.body[0]?.id;
        if (tableId) {
            await request('POST', `/restaurant/tables/${tableId}/status`, {
                status: 'available',
                userId: 'admin',
            });
        }
    }
    
    const seatRes = await request('POST', `/restaurant/tables/${tableId}/seat`, {
        userId: 'admin',
        guestCount: 2,
    }, { 'Idempotency-Key': `test-kitchen-${Date.now()}` });
    
    const orderId = seatRes.body.orderId;
    
    // Send to kitchen with idempotency key
    const idempKey = `test-kitchen-send-${Date.now()}`;
    
    const send1 = await request('POST', '/restaurant/kitchen/send', {
        orderId,
        items: [{ productId: 1, productName: 'Burger', quantity: 1 }],
        userId: 'admin',
    }, { 'Idempotency-Key': idempKey });
    
    console.log(`   First send: ${send1.status} - ${JSON.stringify(send1.body)}`);
    
    // Retry with same key
    const send2 = await request('POST', '/restaurant/kitchen/send', {
        orderId,
        items: [{ productId: 1, productName: 'Burger', quantity: 1 }],
        userId: 'admin',
    }, { 'Idempotency-Key': idempKey });
    
    console.log(`   Retry send: ${send2.status} - ${JSON.stringify(send2.body)}`);
    
    assert(send1.status === 200, 'First kitchen send succeeds');
    assert(send2.status === 200, 'Retry returns same success status');
    assert(send1.body.orderId === send2.body.orderId, 'Same order ID returned on retry');
    assert(send1.body.itemsSent === send2.body.itemsSent, 'Same item count on retry');
    
    // Clean up
    await request('POST', `/orders/${orderId}/bill`, { userId: 'admin' });
    await request('POST', '/payments', { orderId, method: 'cash' });
    await request('POST', `/orders/${orderId}/close`, { userId: 'admin' });
    // Follow state machine: billed -> needs_cleaning -> available
    await request('POST', `/restaurant/tables/${tableId}/status`, {
        status: 'needs_cleaning',
        userId: 'admin',
    });
    await request('POST', `/restaurant/tables/${tableId}/status`, {
        status: 'available',
        userId: 'admin',
    });
}

// ============================================================================
// TEST 5: Money Safety - Integer Cents
// ============================================================================
async function testMoneySafety() {
    console.log('\n💰 TEST 5: Money Safety - Integer Cents');
    console.log('   Verify server returns amounts in cents');
    
    // Create order, send to kitchen, bill
    const tablesRes = await request('GET', '/restaurant/tables');
    let tableId = tablesRes.body.find(t => t.status === 'available')?.id;
    
    if (!tableId) {
        tableId = tablesRes.body[0]?.id;
        if (tableId) {
            await request('POST', `/restaurant/tables/${tableId}/status`, {
                status: 'available',
                userId: 'admin',
            });
        }
    }
    
    const seatRes = await request('POST', `/restaurant/tables/${tableId}/seat`, {
        userId: 'admin',
        guestCount: 2,
    }, { 'Idempotency-Key': `test-money-${Date.now()}` });
    
    const orderId = seatRes.body.orderId;
    
    // Send multiple items
    const sendRes = await request('POST', '/restaurant/kitchen/send', {
        orderId,
        items: [
            { productId: 1, productName: 'Burger', quantity: 2 },
        ],
        userId: 'admin',
    });
    
    console.log(`   Kitchen response: ${JSON.stringify(sendRes.body)}`);
    
    // Generate bill
    const billRes = await request('POST', `/orders/${orderId}/bill`, { userId: 'admin' });
    console.log(`   Bill response: ${JSON.stringify(billRes.body)}`);
    
    assert(
        typeof billRes.body.subtotalCents === 'number',
        'Bill includes subtotalCents as integer'
    );
    assert(
        typeof billRes.body.taxAmountCents === 'number',
        'Bill includes taxAmountCents as integer'
    );
    assert(
        typeof billRes.body.totalAmountCents === 'number',
        'Bill includes totalAmountCents as integer'
    );
    assert(
        Number.isInteger(billRes.body.subtotalCents),
        'subtotalCents is an integer (no decimals)'
    );
    assert(
        Number.isInteger(billRes.body.totalAmountCents),
        'totalAmountCents is an integer (no decimals)'
    );
    
    // Pay and check payment response
    const payRes = await request('POST', '/payments', {
        orderId,
        method: 'cash',
    });
    
    console.log(`   Payment response: ${JSON.stringify(payRes.body)}`);
    
    assert(
        typeof payRes.body.amountCents === 'number',
        'Payment includes amountCents'
    );
    assert(
        Number.isInteger(payRes.body.amountCents),
        'amountCents is an integer'
    );
    
    // Clean up
    await request('POST', `/orders/${orderId}/close`, { userId: 'admin' });
    // Follow state machine: billed -> needs_cleaning -> available
    await request('POST', `/restaurant/tables/${tableId}/status`, {
        status: 'needs_cleaning',
        userId: 'admin',
    });
    await request('POST', `/restaurant/tables/${tableId}/status`, {
        status: 'available',
        userId: 'admin',
    });
}

// ============================================================================
// MAIN
// ============================================================================

// Helper to fully cleanup a single table through the proper state machine
async function cleanupSingleTable(table) {
    const tableId = table.id;
    const orderId = table.order_id;
    const status = table.status;
    
    // If there's an order, we need to complete its lifecycle
    if (orderId) {
        // Try to add items if order is empty (required for billing)
        await request('POST', '/restaurant/kitchen/send', {
            orderId,
            items: [{ productId: 1, productName: 'Cleanup Item', quantity: 1 }],
            userId: 'admin',
        });
        
        // Try to bill the order
        await request('POST', `/orders/${orderId}/bill`, { userId: 'admin' });
        
        // Try to pay the order  
        await request('POST', '/payments', { orderId, method: 'cash' });
        
        // Try to close the order
        await request('POST', `/orders/${orderId}/close`, { userId: 'admin' });
    }
    
    // Now transition through state machine based on current status
    if (status === 'seated') {
        // seated -> billed -> needs_cleaning -> available
        // Since we handled the order above, try billed (may already be billed)
        await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'billed', userId: 'admin' });
        await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'needs_cleaning', userId: 'admin' });
        await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'available', userId: 'admin' });
    } else if (status === 'billed') {
        // billed -> needs_cleaning -> available
        await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'needs_cleaning', userId: 'admin' });
        await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'available', userId: 'admin' });
    } else if (status === 'needs_cleaning') {
        // needs_cleaning -> available
        await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'available', userId: 'admin' });
    } else if (status === 'reserved' || status === 'blocked') {
        // reserved/blocked -> available
        await request('POST', `/restaurant/tables/${tableId}/status`, { status: 'available', userId: 'admin' });
    }
    // If already available, do nothing
}

async function cleanupAllTables() {
    // Get all tables and reset them to available
    const tablesRes = await request('GET', '/restaurant/tables');
    
    const notAvailable = tablesRes.body.filter(t => t.status !== 'available');
    if (notAvailable.length > 0) {
        console.log(`   Cleanup: ${notAvailable.length} tables need cleanup: ${notAvailable.map(t => `${t.id}:${t.status}:order=${t.order_id}`).join(', ')}`);
    }
    
    for (const table of tablesRes.body || []) {
        if (table.status !== 'available') {
            try {
                await cleanupSingleTable(table);
            } catch (e) {
                console.log(`   Cleanup error for table ${table.id}: ${e.message}`);
            }
        }
    }
    
    // Wait a moment for any async operations
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify cleanup worked
    const afterRes = await request('GET', '/restaurant/tables');
    const stillNotAvailable = afterRes.body.filter(t => t.status !== 'available');
    if (stillNotAvailable.length > 0) {
        console.log(`   ⚠️  ${stillNotAvailable.length} tables still not available: ${stillNotAvailable.map(t => `${t.id}:${t.status}`).join(', ')}`);
    }
}

async function runTests() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   UniversalPOS Production Hardening - Concurrency Tests');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Check server is running
    try {
        const health = await request('GET', '/api/health');
        if (health.status !== 200) {
            console.log('❌ Server is not running. Start with: node server.js');
            process.exit(1);
        }
        console.log('✅ Server is running');
    } catch (e) {
        console.log('❌ Cannot connect to server. Start with: node server.js');
        process.exit(1);
    }
    
    // Clean up all tables before running tests
    console.log('   Cleaning up tables...');
    await cleanupAllTables();
    
    // Run tests
    await testDoubleSeatPrevention();
    await cleanupAllTables();
    
    await testDoublePaymentPrevention();
    await cleanupAllTables();
    
    await testIdempotencyRetryPayment();
    await cleanupAllTables();
    
    await testIdempotencyRetryKitchen();
    await cleanupAllTables();
    
    await testMoneySafety();
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`   Results: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
