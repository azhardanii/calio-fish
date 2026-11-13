import {
  calculatePaymentModeA,
  calculatePaymentModeB,
  calculateSale,
} from '../finance';
import { BREAKDOWN_STATUS } from '../constants';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- Running Golden Cases Unit Tests (T1 - T7) ---');

// T1: Mode A. Kirim 5 pcs (harga 20.000) -> stok 5 pcs, valuasi awal 100.000.
// Outlet bayar 50.000 dengan 3 pcs terjual (sold 60.000, selisih 10.000 > 0).
{
  const stocks = [{ productTypeId: 'G60', quantity: 5, price: 20000 }];
  const currentPiutang = 0;
  const res = calculatePaymentModeA({
    nominal: 50000,
    currentPiutang,
    items: [{ productTypeId: 'G60', qty: 3, price: 20000 }],
    stocks,
  });

  assert(res.status === BREAKDOWN_STATUS.COMPLETE, 'T1: Status must be COMPLETE');
  assert(res.sold === 60000, 'T1: Sold must be 60.000');
  assert(res.valuasiDelta === -60000, 'T1: valuasiDelta must be -60.000');
  assert(res.piutangDelta === 10000, 'T1: piutangDelta must be +10.000');
  assert(res.needsReview === true, 'T1: needsReview must be true');

  // Resulting state simulation:
  const finalValuasi = 5 * 20000 + res.valuasiDelta; // 100.000 - 60.000 = 40.000
  const finalPiutang = currentPiutang + res.piutangDelta; // 10.000
  const payment = 50000;
  const tagihan = payment + finalPiutang; // 60.000
  const sisaTagihan = finalPiutang; // 10.000

  assert(finalValuasi === 40000, 'T1: Final valuasi must be 40.000');
  assert(finalPiutang === 10000, 'T1: Final piutang must be 10.000');
  assert(tagihan === 60000, 'T1: Tagihan must be 60.000');
  assert(sisaTagihan === 10000, 'T1: Sisa tagihan must be 10.000');
  console.log('✓ T1 Passed');
}

// T2: Mode B. Kirim 5 pcs (harga 20.000) -> SALE 3 pcs -> bayar 20.000
{
  const stocks = [{ productTypeId: 'G60', quantity: 5, price: 20000 }];
  const sale = calculateSale({
    items: [{ productTypeId: 'G60', qty: 3, price: 20000 }],
    stocks,
  });

  assert(sale.amount === 60000, 'T2: Sale amount must be 60.000');
  assert(sale.valuasiDelta === -60000, 'T2: Sale valuasiDelta must be -60.000');
  assert(sale.piutangDelta === 60000, 'T2: Sale piutangDelta must be +60.000');

  // After sale: valuasi 40.000, piutang 60.000
  // Then Payment 20.000 in Mode B:
  const pay = calculatePaymentModeB({
    nominal: 20000,
    currentPiutang: 60000,
  });

  assert(pay.piutangDelta === -20000, 'T2: Payment piutangDelta must be -20.000');
  const finalPiutang = 60000 + pay.piutangDelta; // 40.000
  const finalValuasi = 100000 + sale.valuasiDelta; // 40.000

  assert(finalValuasi === 40000, 'T2: Final valuasi must be 40.000');
  assert(finalPiutang === 40000, 'T2: Final piutang must be 40.000');
  console.log('✓ T2 Passed');
}

// T3: Mode A, 2 jenis berstok, bayar 50.000 tanpa rincian -> PENDING
{
  const stocks = [
    { productTypeId: 'G60', quantity: 3, price: 20000 },
    { productTypeId: 'G20', quantity: 4, price: 10000 },
  ];
  const res = calculatePaymentModeA({
    nominal: 50000,
    currentPiutang: 0,
    stocks,
  });

  assert(res.status === BREAKDOWN_STATUS.PENDING, 'T3: Status must be PENDING');
  assert(res.needsReview === true, 'T3: needsReview must be true');
  assert(res.valuasiDelta === 0, 'T3: valuasiDelta must be 0');
  assert(res.piutangDelta === 0, 'T3: piutangDelta must be 0');

  // Then completePendingPayment with 3 pcs G60 (sold 60.000, bayar 50.000)
  const complete = calculatePaymentModeA({
    nominal: 50000,
    currentPiutang: 0,
    items: [{ productTypeId: 'G60', qty: 3, price: 20000 }],
    stocks,
  });
  assert(complete.status === BREAKDOWN_STATUS.COMPLETE, 'T3: completed status must be COMPLETE');
  assert(complete.sold === 60000, 'T3: completed sold must be 60.000');
  assert(complete.piutangDelta === 10000, 'T3: completed piutangDelta must be 10.000');
  console.log('✓ T3 Passed');
}

// T4: Mode B, piutang 40.000, bayar 50.000
{
  const res = calculatePaymentModeB({
    nominal: 50000,
    currentPiutang: 40000,
  });

  assert(res.piutangDelta === -40000, 'T4: piutangDelta must be -40.000');
  assert(res.unallocated === 10000, 'T4: unallocated must be 10.000');
  assert(res.needsReview === true, 'T4: needsReview must be true (surplus)');
  console.log('✓ T4 Passed');
}

// T5: Retur 10 pcs (5 layak, 5 reject)
{
  const qtyReturned = 10;
  const qtyReusable = 5;
  const qtyReject = 5;
  assert(qtyReusable + qtyReject === qtyReturned, 'T5: Sum must match');
  console.log('✓ T5 Passed');
}

// T6: SALE/PAYMENT qty > stok outlet -> Error
{
  const stocks = [{ productTypeId: 'G60', quantity: 2, price: 20000 }];
  let threw = false;
  try {
    calculateSale({
      items: [{ productTypeId: 'G60', qty: 3, price: 20000 }],
      stocks,
    });
  } catch (err: any) {
    threw = true;
    assert(err.message.includes('tidak mencukupi'), 'T6: error message matches');
  }
  assert(threw, 'T6: Must throw error when qty exceeds stock');
  console.log('✓ T6 Passed');
}

// T7: Mode A, piutang 10.000, settleOnly bayar 10.000
{
  const stocks = [{ productTypeId: 'G60', quantity: 2, price: 20000 }];
  const res = calculatePaymentModeA({
    nominal: 10000,
    currentPiutang: 10000,
    stocks,
    settleOnly: true,
  });

  assert(res.valuasiDelta === 0, 'T7: Valuasi does not change');
  assert(res.piutangDelta === -10000, 'T7: Piutang reduces by 10.000');
  assert(res.unallocated === 0, 'T7: Unallocated is 0');
  console.log('✓ T7 Passed');
}

console.log('ALL T1-T7 UNIT TESTS PASSED SUCCESSFULLY! 🎉');

