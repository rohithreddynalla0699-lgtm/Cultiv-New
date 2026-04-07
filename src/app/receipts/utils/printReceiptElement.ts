export function printReceiptElement() {
  const receipt = document.getElementById('print-receipt');
  if (!receipt) return;

  const printWindow = window.open('', '_blank', 'width=480,height=800');
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>CULTIV Receipt</title>
        <style>
          @page {
            margin: 12mm;
            size: auto;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: white;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
          }

          body {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 24px 0;
          }

          #receipt-root {
            width: 360px;
            max-width: 360px;
          }

          button,
          .print-hide {
            display: none !important;
          }

          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div id="receipt-root">${receipt.outerHTML}</div>
      </body>
    </html>
  `);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, 300);
}