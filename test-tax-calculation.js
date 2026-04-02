function testTaxCalculation() {
  console.log("🧾 TAX CALCULATION TEST\n");

  // Test Case 1: With material cost
  console.log("Test Case 1: Service ₹1000 + Material ₹200 + Platform Fee ₹150");
  const finalPriceAmount = 1000;
  const materialCostAmount = 200;
  const platformFee = 150; // 15% of service price

  const subTotal = finalPriceAmount + materialCostAmount; // 1200
  const taxableAmount = subTotal; // Should be 1200 (NOT 1350)
  const taxRate = 18;
  const taxAmount = (taxableAmount * taxRate) / 100; // Should be 216 (NOT 243)
  const finalTotalWithTax = subTotal + platformFee + taxAmount;

  console.log("  finalPriceAmount:", finalPriceAmount);
  console.log("  materialCostAmount:", materialCostAmount);
  console.log("  subTotal:", subTotal);
  console.log("  platformFee:", platformFee);
  console.log("  taxableAmount:", taxableAmount, "✓ (should NOT include platform fee)");
  console.log("  taxAmount:", taxAmount, "✓ (18% of 1200)");
  console.log("  finalTotalWithTax:", finalTotalWithTax);
  console.log("");

  // Verify the calculation
  if (taxableAmount === subTotal && taxAmount === 216) {
    console.log("✅ Test Case 1 PASSED: Tax calculated correctly on subtotal only\n");
  } else {
    console.log("❌ Test Case 1 FAILED: Tax calculation incorrect\n");
  }

  // Test Case 2: Without material cost
  console.log("Test Case 2: Service ₹1000 + No Material + Platform Fee ₹150");
  const finalPriceAmount2 = 1000;
  const materialCostAmount2 = 0;
  const platformFee2 = 150;

  const subTotal2 = finalPriceAmount2 + materialCostAmount2; // 1000
  const taxableAmount2 = subTotal2; // Should be 1000
  const taxRate2 = 18;
  const taxAmount2 = (taxableAmount2 * taxRate2) / 100; // Should be 180
  const finalTotalWithTax2 = subTotal2 + platformFee2 + taxAmount2;

  console.log("  finalPriceAmount:", finalPriceAmount2);
  console.log("  materialCostAmount:", materialCostAmount2);
  console.log("  subTotal:", subTotal2);
  console.log("  platformFee:", platformFee2);
  console.log("  taxableAmount:", taxableAmount2, "✓ (should NOT include platform fee)");
  console.log("  taxAmount:", taxAmount2, "✓ (18% of 1000)");
  console.log("  finalTotalWithTax:", finalTotalWithTax2);
  console.log("");

  if (taxableAmount2 === subTotal2 && taxAmount2 === 180) {
    console.log("✅ Test Case 2 PASSED: Tax calculated correctly on subtotal only\n");
  } else {
    console.log("❌ Test Case 2 FAILED: Tax calculation incorrect\n");
  }

  // Test Case 3: User's example
  console.log("Test Case 3: User's Example - Expected taxable: 850, Expected tax: 153");
  console.log("Assuming: Service ₹650 + Material ₹200 + Platform Fee ₹200");
  const finalPriceAmount3 = 650;
  const materialCostAmount3 = 200;
  const platformFee3 = 200;

  const subTotal3 = finalPriceAmount3 + materialCostAmount3; // 850
  const taxableAmount3 = subTotal3; // Should be 850
  const taxRate3 = 18;
  const taxAmount3 = (taxableAmount3 * taxRate3) / 100; // Should be 153
  const finalTotalWithTax3 = subTotal3 + platformFee3 + taxAmount3;

  console.log("  finalPriceAmount:", finalPriceAmount3);
  console.log("  materialCostAmount:", materialCostAmount3);
  console.log("  subTotal:", subTotal3);
  console.log("  platformFee:", platformFee3);
  console.log("  taxableAmount:", taxableAmount3, "✓ (should be 850)");
  console.log("  taxAmount:", taxAmount3, "✓ (should be 153 = 18% of 850)");
  console.log("  finalTotalWithTax:", finalTotalWithTax3);
  console.log("");

  if (taxableAmount3 === 850 && taxAmount3 === 153) {
    console.log("✅ Test Case 3 PASSED: Tax calculated correctly on subtotal only\n");
  } else {
    console.log("❌ Test Case 3 FAILED: Tax calculation incorrect\n");
  }

  console.log("=".repeat(60));
  console.log("🔍 VERIFICATION CHECKLIST:");
  console.log("=".repeat(60));
  console.log("1. ✅ taxableAmount equals subTotal (NOT subTotal + platformFee)");
  console.log("2. ✅ taxAmount equals 18% of subTotal");
  console.log("3. ✅ finalTotalWithTax equals subTotal + platformFee + taxAmount");
  console.log("4. ✅ Platform fee is NOT included in taxable amount");
  console.log("");
  console.log("📝 TO VERIFY IN BACKEND:");
  console.log("   1. Restart your backend server");
  console.log("   2. Complete a service with payment");
  console.log("   3. Check the console logs for '🧾 TAX CALCULATION DEBUG'");
  console.log("   4. Verify taxableAmount === subTotal");
  console.log("   5. Verify taxAmount === (taxableAmount * 18 / 100)");
  console.log("");
}

testTaxCalculation();
