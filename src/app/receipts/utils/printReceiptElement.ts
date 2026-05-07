const PRINT_READY_TIMEOUT_MS = 2000;

function getPrintableHeadMarkup() {
  const styleNodes = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  );

  return styleNodes.map((node) => node.outerHTML).join('\n');
}

function waitForStyles(printDocument: Document) {
  const links = Array.from(
    printDocument.querySelectorAll('link[rel="stylesheet"]'),
  ) as HTMLLinkElement[];

  if (links.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          if ((link.sheet as CSSStyleSheet | null) || link.dataset.loaded === 'true') {
            resolve();
            return;
          }

          const finish = () => {
            link.dataset.loaded = 'true';
            resolve();
          };

          link.addEventListener('load', finish, { once: true });
          link.addEventListener('error', finish, { once: true });
        }),
    ),
  ).then(() => undefined);
}

function waitForFonts(printDocument: Document) {
  const fonts = (printDocument as Document & {
    fonts?: { ready?: Promise<unknown> };
  }).fonts;

  if (!fonts?.ready) {
    return Promise.resolve();
  }

  return fonts.ready.then(() => undefined).catch(() => undefined);
}

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <base href="${document.baseURI}" />
        <title>CULTIV Receipt</title>
        ${getPrintableHeadMarkup()}
        <style>
          @page {
            margin: 12mm;
            size: auto;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 24px 0;
          }

          #receipt-root {
            width: min(100%, 380px);
            max-width: 380px;
            margin: 0 auto;
          }

          #print-receipt {
            width: 100% !important;
            max-width: 380px !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          button,
          .print-hide,
          .print\\:hidden {
            display: none !important;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>
      <body>
        <div id="receipt-root">${receipt.outerHTML}</div>
      </body>
    </html>
  `);
  printWindow.document.close();

  let printCompleted = false;
  const triggerPrint = () => {
    if (printCompleted || printWindow.closed) return;
    printCompleted = true;
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const readyPromise = Promise.all([
    waitForStyles(printWindow.document),
    waitForFonts(printWindow.document),
  ]).catch(() => undefined);

  void Promise.race([
    readyPromise,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, PRINT_READY_TIMEOUT_MS);
    }),
  ]).then(() => {
    window.setTimeout(triggerPrint, 50);
  });
}
