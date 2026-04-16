import { chromium } from "playwright";

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto("http://localhost:9000/", { timeout: 30000 });
await page.waitForTimeout(5000);

// Look at all select elements and their options
const selects = await page.evaluate(() => {
  return Array.from(document.querySelectorAll("select")).map((s, i) => ({
    index: i,
    options: Array.from(s.options).map((o) => ({
      label: o.label,
      value: o.value,
      selected: o.selected,
    })),
  }));
});
console.log("Selects:", JSON.stringify(selects, null, 2));

// Look at checkboxes/inputs  
const inputs = await page.evaluate(() => {
  return Array.from(document.querySelectorAll("input")).slice(0, 20).map((inp) => ({
    type: inp.type,
    value: inp.value,
    checked: inp.checked,
    label: inp.labels?.[0]?.textContent?.trim(),
    name: inp.name,
    placeholder: inp.placeholder,
  }));
});
console.log("Inputs:", JSON.stringify(inputs, null, 2));

// Look at "range" label area - might show scene selection
const rangeLabels = await page.evaluate(() => {
  const labels = Array.from(document.querySelectorAll("label"));
  return labels.map((l) => ({
    text: l.textContent?.trim().slice(0, 60),
    htmlFor: l.htmlFor,
  }));
});
console.log("Labels:", JSON.stringify(rangeLabels, null, 2));

await browser.close();
