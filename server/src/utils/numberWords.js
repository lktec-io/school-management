const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']];

function belowThousand(n) {
  const parts = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
    if (n) parts.push('and');
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

function integerToWords(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  let rest = n;
  for (const [value, label] of SCALES) {
    if (rest >= value) {
      parts.push(`${belowThousand(Math.floor(rest / value))} ${label}`);
      rest %= value;
    }
  }
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

/** 150000.5 → "One Hundred and Fifty Thousand Shillings and Fifty Cents Only" */
export function amountInWords(amount) {
  const cents = Math.round(Number(amount) * 100);
  const shillings = Math.floor(cents / 100);
  const remainder = cents % 100;
  let words = `${integerToWords(shillings)} Shilling${shillings === 1 ? '' : 's'}`;
  if (remainder) words += ` and ${integerToWords(remainder)} Cent${remainder === 1 ? '' : 's'}`;
  return `${words} Only`;
}
