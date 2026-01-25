/**
 * Thermal Printer Utility for UniversalPOS
 * ESC/POS mode for Xprinter driver on 80mm thermal paper
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');

// Printer configuration
const PRINTER_CONFIG = {
    name: process.env.PRINTER_NAME || 'Xprinter XP-80(Copy 1)',
    width: 42, // characters per line for 80mm paper with default font
    leftMargin: 0, // ESC/POS handles centering
    encoding: 'ascii',
    businessName: process.env.BUSINESS_NAME || 'Rio Chicken',
    useEscPos: true, // ESC/POS driver now installed
    logoPath: path.join(__dirname, 'logo.png'), // Logo file path
    logoWidth: 384, // Logo width in pixels (max for 80mm paper ~576, but 384 looks good)
    qrPath: path.join(__dirname, 'qr.png'), // QR code for payment
    qrWidth: 200 // QR code width in pixels
};

// ASCII Art Logo for Rio Chicken - set to empty to disable
const LOGO_ASCII = [];
// To add a logo later, populate this array with strings

/**
 * Convert image to ESC/POS raster bitmap
 * Returns buffer with GS v 0 command for raster bit image
 */
async function imageToEscPos(imagePath, targetWidth = 384) {
    try {
        if (!fs.existsSync(imagePath)) {
            console.log('Logo file not found:', imagePath);
            return null;
        }

        // Load and process image with sharp
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        
        // Calculate height maintaining aspect ratio
        const aspectRatio = metadata.height / metadata.width;
        const targetHeight = Math.round(targetWidth * aspectRatio);
        
        // Resize, convert to grayscale, then to raw pixels
        const { data, info } = await image
            .resize(targetWidth, targetHeight, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
            .grayscale()
            .raw()
            .toBuffer({ resolveWithObject: true });
        
        const width = info.width;
        const height = info.height;
        
        // Convert to monochrome bitmap (1 bit per pixel)
        // ESC/POS uses: 1 = black, 0 = white (inverted from typical)
        const bytesPerRow = Math.ceil(width / 8);
        const bitmapData = Buffer.alloc(bytesPerRow * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = y * width + x;
                const grayValue = data[pixelIndex];
                
                // Threshold: if darker than 128, it's black (bit = 1)
                if (grayValue < 128) {
                    const byteIndex = y * bytesPerRow + Math.floor(x / 8);
                    const bitIndex = 7 - (x % 8);
                    bitmapData[byteIndex] |= (1 << bitIndex);
                }
            }
        }
        
        // Build ESC/POS raster bit image command: GS v 0
        // Format: GS v 0 m xL xH yL yH [data]
        // m = 0 (normal), xL/xH = width in bytes, yL/yH = height in dots
        const widthL = bytesPerRow & 0xFF;
        const widthH = (bytesPerRow >> 8) & 0xFF;
        const heightL = height & 0xFF;
        const heightH = (height >> 8) & 0xFF;
        
        const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, widthL, widthH, heightL, heightH]);
        
        return Buffer.concat([header, bitmapData]);
    } catch (err) {
        console.error('Error converting image:', err.message);
        return null;
    }
}

// ESC/POS Commands (only used if useEscPos is true)
const ESC = 0x1B;
const GS = 0x1D;
const COMMANDS = {
    INIT: Buffer.from([ESC, 0x40]),
    CUT: Buffer.from([GS, 0x56, 0x42, 0x00]),
    ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
    ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
    ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),
    BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
    BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
    DOUBLE_HEIGHT_ON: Buffer.from([ESC, 0x21, 0x10]),
    DOUBLE_WIDTH_ON: Buffer.from([ESC, 0x21, 0x20]),
    DOUBLE_SIZE_ON: Buffer.from([ESC, 0x21, 0x30]),
    NORMAL_SIZE: Buffer.from([ESC, 0x21, 0x00]),
    LINE_FEED: Buffer.from([0x0A]),
    FEED_LINES: (n) => Buffer.from([ESC, 0x64, n])
};

/**
 * Create a horizontal line
 */
function line(char = '-') {
    return char.repeat(PRINTER_CONFIG.width);
}

/**
 * Pad/format text to fixed width
 */
function padRight(text, width) {
    return String(text).substring(0, width).padEnd(width);
}

function padLeft(text, width) {
    return String(text).substring(0, width).padStart(width);
}

/**
 * Center text within width
 */
function centerText(text, width = PRINTER_CONFIG.width) {
    const str = String(text).substring(0, width);
    const padding = Math.floor((width - str.length) / 2);
    return ' '.repeat(padding) + str;
}

/**
 * Format a line with left and right text (right-aligned price)
 */
function formatLine(left, right, width = PRINTER_CONFIG.width) {
    const leftStr = String(left);
    const rightStr = String(right);
    const space = width - leftStr.length - rightStr.length;
    if (space < 1) {
        return leftStr.substring(0, width - rightStr.length - 1) + ' ' + rightStr;
    }
    return leftStr + ' '.repeat(space) + rightStr;
}

/**
 * Build kitchen ticket using ESC/POS commands - CENTERED, only new items
 */
async function buildKitchenTicketBuffer(order, businessName = PRINTER_CONFIG.businessName) {
    const buffers = [];
    
    // Initialize printer
    buffers.push(COMMANDS.INIT);
    
    // Everything centered
    buffers.push(COMMANDS.ALIGN_CENTER);
    
    // Separator line
    buffers.push(Buffer.from(line('=') + '\n', 'ascii'));
    buffers.push(Buffer.from('\n', 'ascii'));
    
    // TABLE NUMBER - BIG AND BOLD
    buffers.push(COMMANDS.BOLD_ON);
    buffers.push(COMMANDS.DOUBLE_SIZE_ON);
    if (order.tableName && order.tableName.toLowerCase() !== 'walk-in') {
        buffers.push(Buffer.from(`${order.tableName}\n`, 'ascii'));
    } else {
        buffers.push(Buffer.from('TAKEAWAY\n', 'ascii'));
    }
    buffers.push(COMMANDS.NORMAL_SIZE);
    buffers.push(COMMANDS.BOLD_OFF);
    buffers.push(Buffer.from('\n', 'ascii'));
    
    // Time
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    buffers.push(Buffer.from(`${timeStr}\n`, 'ascii'));
    buffers.push(Buffer.from('\n', 'ascii'));
    
    buffers.push(Buffer.from(line('-') + '\n', 'ascii'));
    buffers.push(Buffer.from('\n', 'ascii'));
    
    // Items - DOUBLE SIZE, CENTERED
    if (order.items && order.items.length > 0) {
        buffers.push(COMMANDS.DOUBLE_HEIGHT_ON);
        buffers.push(COMMANDS.BOLD_ON);
        order.items.forEach(item => {
            const qty = item.quantity || 1;
            const name = item.name || 'Item';
            buffers.push(Buffer.from(`${qty}x ${name}\n`, 'ascii'));
            buffers.push(Buffer.from('\n', 'ascii'));
            
            // Notes - smaller, still centered
            if (item.notes) {
                buffers.push(COMMANDS.NORMAL_SIZE);
                buffers.push(COMMANDS.BOLD_OFF);
                buffers.push(Buffer.from(`>> ${item.notes}\n`, 'ascii'));
                buffers.push(Buffer.from('\n', 'ascii'));
                buffers.push(COMMANDS.DOUBLE_HEIGHT_ON);
                buffers.push(COMMANDS.BOLD_ON);
            }
        });
        buffers.push(COMMANDS.NORMAL_SIZE);
        buffers.push(COMMANDS.BOLD_OFF);
    }
    
    buffers.push(Buffer.from(line('=') + '\n', 'ascii'));
    
    // Feed and cut
    buffers.push(COMMANDS.FEED_LINES(4));
    buffers.push(COMMANDS.CUT);
    
    return Buffer.concat(buffers);
}

/**
 * Build receipt using ESC/POS commands (async for logo loading)
 */
async function buildReceiptBufferEscPos(order, businessName = PRINTER_CONFIG.businessName) {
    const buffers = [];
    const w = PRINTER_CONFIG.width;
    const m = '   '; // Left margin for content (3 spaces)
    
    // Initialize printer
    buffers.push(COMMANDS.INIT);
    
    // Center alignment for logo and header
    buffers.push(COMMANDS.ALIGN_CENTER);
    
    // Try to print logo
    const logoBuffer = await imageToEscPos(PRINTER_CONFIG.logoPath, PRINTER_CONFIG.logoWidth);
    if (logoBuffer) {
        buffers.push(logoBuffer);
        buffers.push(Buffer.from('\n', 'ascii'));
    }
    
    // Header - centered, double size (only show text if no logo)
    if (!logoBuffer) {
        buffers.push(COMMANDS.DOUBLE_SIZE_ON);
        buffers.push(Buffer.from(businessName + '\n', 'ascii'));
        buffers.push(COMMANDS.NORMAL_SIZE);
    }
    buffers.push(Buffer.from('\n', 'ascii'));
    
    buffers.push(Buffer.from(line('=') + '\n', 'ascii'));
    buffers.push(COMMANDS.BOLD_ON);
    buffers.push(Buffer.from('RECEIPT\n', 'ascii'));
    buffers.push(COMMANDS.BOLD_OFF);
    buffers.push(Buffer.from(line('=') + '\n\n', 'ascii'));
    
    // Order info - left aligned with margin
    buffers.push(COMMANDS.ALIGN_LEFT);
    buffers.push(Buffer.from(`${m}Order #: ${order.id || 'N/A'}\n\n`, 'ascii'));
    if (order.tableName) {
        buffers.push(Buffer.from(`${m}Table: ${order.tableName}\n\n`, 'ascii'));
    }
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    buffers.push(Buffer.from(`${m}Date: ${dateStr}\n\n`, 'ascii'));
    buffers.push(Buffer.from(`${m}${line('-')}\n\n`, 'ascii'));
    
    // Items
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const qty = item.quantity || 1;
            const name = item.name || 'Item';
            const price = ((item.totalPriceCents || 0) / 100).toFixed(0);
            const itemText = `${qty}x ${name}`;
            buffers.push(Buffer.from(`${m}${formatLine(itemText, price, w - 3)}\n\n`, 'ascii'));
            
            if (item.modifiers && item.modifiers.length > 0) {
                item.modifiers.forEach(mod => {
                    buffers.push(Buffer.from(`${m}   + ${mod}\n`, 'ascii'));
                });
            }
        });
    }
    
    buffers.push(Buffer.from(`${m}${line('-')}\n\n`, 'ascii'));
    
    // Totals
    const subtotal = ((order.subtotalCents || 0) / 100).toFixed(0);
    const tax = ((order.taxAmountCents || 0) / 100).toFixed(0);
    const total = ((order.totalAmountCents || 0) / 100).toFixed(0);
    
    buffers.push(Buffer.from(`${m}${formatLine('Subtotal:', subtotal, w - 3)}\n\n`, 'ascii'));
    buffers.push(Buffer.from(`${m}${formatLine('Tax:', tax, w - 3)}\n\n`, 'ascii'));
    buffers.push(COMMANDS.BOLD_ON);
    buffers.push(COMMANDS.DOUBLE_HEIGHT_ON);
    buffers.push(Buffer.from(`${m}${formatLine('TOTAL:', total, w - 3)}\n\n`, 'ascii'));
    buffers.push(COMMANDS.NORMAL_SIZE);
    buffers.push(COMMANDS.BOLD_OFF);
    
    // Payment info
    if (order.paymentMethod) {
        buffers.push(Buffer.from(`${m}${line('-')}\n\n`, 'ascii'));
        buffers.push(Buffer.from(`${m}Paid by: ${order.paymentMethod}\n\n`, 'ascii'));
    }
    
    // Footer - centered with QR code
    buffers.push(COMMANDS.ALIGN_CENTER);
    buffers.push(Buffer.from('\n', 'ascii'));
    
    // Print QR code for payment
    const qrBuffer = await imageToEscPos(PRINTER_CONFIG.qrPath, PRINTER_CONFIG.qrWidth);
    if (qrBuffer) {
        buffers.push(Buffer.from('Scan to Pay:\n', 'ascii'));
        buffers.push(qrBuffer);
        buffers.push(Buffer.from('\n', 'ascii'));
    }
    
    // Different end note for takeaway vs dine-in
    const isTakeaway = !order.tableName || 
                       order.tableName.toLowerCase() === 'takeaway' || 
                       order.tableName.toLowerCase() === 'walk-in';
    const endNote = isTakeaway ? 'Thank you!' : 'Thank you for your visit!';
    buffers.push(Buffer.from(`\n${endNote}\n`, 'ascii'));
    
    // Feed and cut
    buffers.push(COMMANDS.FEED_LINES(4));
    buffers.push(COMMANDS.CUT);
    
    return Buffer.concat(buffers);
}

/**
 * Build receipt as plain text (no ESC/POS commands)
 */
async function buildReceiptBuffer(order, businessName = PRINTER_CONFIG.businessName) {
    // Use ESC/POS if enabled
    if (PRINTER_CONFIG.useEscPos) {
        return await buildReceiptBufferEscPos(order, businessName);
    }
    
    const lines = [];
    const w = PRINTER_CONFIG.width;
    const margin = ' '.repeat(PRINTER_CONFIG.leftMargin);
    const fullWidth = w + PRINTER_CONFIG.leftMargin * 2; // Full paper width for centering
    
    // Header - centered with logo
    lines.push({ text: '', centered: true });
    
    // Add ASCII logo
    LOGO_ASCII.forEach(logoLine => {
        lines.push({ text: centerText(logoLine, fullWidth), centered: true });
    });
    
    lines.push({ text: '', centered: true });
    lines.push({ text: centerText(businessName, fullWidth), centered: true });
    lines.push({ text: '', centered: true });
    lines.push({ text: centerText('='.repeat(w), fullWidth), centered: true });
    lines.push({ text: centerText('RECEIPT', fullWidth), centered: true });
    lines.push({ text: centerText('='.repeat(w), fullWidth), centered: true });
    lines.push({ text: '', centered: true });
    
    // Order info - left aligned with margin
    lines.push({ text: `Order #: ${order.id || 'N/A'}`, centered: false });
    lines.push({ text: '', centered: false });
    if (order.tableName) {
        lines.push({ text: `Table: ${order.tableName}`, centered: false });
        lines.push({ text: '', centered: false });
    }
    // Use simple ASCII date format (avoid locale-specific characters)
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    lines.push({ text: `Date: ${dateStr}`, centered: false });
    lines.push({ text: '', centered: false });
    if (order.serverName) {
        lines.push({ text: `Server: ${order.serverName}`, centered: false });
        lines.push({ text: '', centered: false });
    }
    lines.push({ text: line('-'), centered: false });
    lines.push({ text: '', centered: false });
    
    // Items - left aligned with margin
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const qty = item.quantity || 1;
            const name = item.name || 'Item';
            const price = ((item.totalPriceCents || 0) / 100).toFixed(0);
            
            // Item with price on same line, right-aligned
            const itemText = `${qty}x ${name}`;
            lines.push({ text: formatLine(itemText, price, w), centered: false });
            lines.push({ text: '', centered: false });
            
            // Modifiers if any
            if (item.modifiers && item.modifiers.length > 0) {
                item.modifiers.forEach(mod => {
                    lines.push({ text: `   + ${mod}`, centered: false });
                });
            }
        });
    }
    
    lines.push({ text: line('-'), centered: false });
    lines.push({ text: '', centered: false });
    
    // Totals - left aligned with margin
    const subtotal = ((order.subtotalCents || 0) / 100).toFixed(0);
    const tax = ((order.taxAmountCents || 0) / 100).toFixed(0);
    const total = ((order.totalAmountCents || 0) / 100).toFixed(0);
    
    lines.push({ text: formatLine('Subtotal:', subtotal, w), centered: false });
    lines.push({ text: '', centered: false });
    lines.push({ text: formatLine('Tax:', tax, w), centered: false });
    lines.push({ text: '', centered: false });
    lines.push({ text: formatLine('TOTAL:', total, w), centered: false });
    lines.push({ text: '', centered: false });
    
    // Payment info
    if (order.paymentMethod) {
        lines.push({ text: line('-'), centered: false });
        lines.push({ text: '', centered: false });
        lines.push({ text: `Paid by: ${order.paymentMethod}`, centered: false });
        lines.push({ text: '', centered: false });
    }
    
    // Footer - centered
    lines.push({ text: '', centered: true });
    lines.push({ text: centerText('Thank you for your visit!', fullWidth), centered: true });
    lines.push({ text: '', centered: true });
    lines.push({ text: '', centered: true });
    lines.push({ text: '', centered: true });
    lines.push({ text: '', centered: true });
    lines.push({ text: '', centered: true });
    
    // Build final text - centered lines have no margin, left-aligned lines have margin
    const text = lines.map(l => l.centered ? l.text : margin + l.text).join('\r\n') + '\r\n';
    return Buffer.from(text, PRINTER_CONFIG.encoding);
}

/**
 * Build daily report with ESC/POS - header centered, content left-aligned
 */
function buildDailyReportBuffer(reportData, businessName = PRINTER_CONFIG.businessName) {
    const buffers = [];
    const w = PRINTER_CONFIG.width;
    
    const startDate = new Date(reportData.period?.start || new Date());
    const endDate = new Date(reportData.period?.end || new Date());
    
    // Initialize printer
    buffers.push(COMMANDS.INIT);
    
    // Header - CENTERED
    buffers.push(COMMANDS.ALIGN_CENTER);
    buffers.push(Buffer.from('\n', 'ascii'));
    buffers.push(COMMANDS.BOLD_ON);
    buffers.push(COMMANDS.DOUBLE_SIZE_ON);
    buffers.push(Buffer.from(businessName + '\n', 'ascii'));
    buffers.push(COMMANDS.NORMAL_SIZE);
    buffers.push(COMMANDS.BOLD_OFF);
    buffers.push(Buffer.from('\n', 'ascii'));
    buffers.push(Buffer.from(line('=') + '\n', 'ascii'));
    buffers.push(COMMANDS.BOLD_ON);
    buffers.push(COMMANDS.DOUBLE_HEIGHT_ON);
    buffers.push(Buffer.from('DAILY REPORT\n', 'ascii'));
    buffers.push(COMMANDS.NORMAL_SIZE);
    buffers.push(COMMANDS.BOLD_OFF);
    buffers.push(Buffer.from(line('=') + '\n\n', 'ascii'));
    
    // All content below - LEFT ALIGNED
    buffers.push(COMMANDS.ALIGN_LEFT);
    
    // Period
    buffers.push(Buffer.from(`Date: ${startDate.toLocaleDateString()}\n`, 'ascii'));
    buffers.push(Buffer.from(`Start: ${startDate.toLocaleTimeString()}\n`, 'ascii'));
    buffers.push(Buffer.from(`End: ${endDate.toLocaleTimeString()}\n`, 'ascii'));
    buffers.push(Buffer.from(line('-') + '\n\n', 'ascii'));
    
    // Sales Summary
    buffers.push(COMMANDS.BOLD_ON);
    buffers.push(Buffer.from('SALES SUMMARY\n', 'ascii'));
    buffers.push(COMMANDS.BOLD_OFF);
    const orders = reportData.orders || {};
    buffers.push(Buffer.from(formatLine('Total Orders:', String(orders.total || 0), w) + '\n', 'ascii'));
    buffers.push(Buffer.from(formatLine('Completed:', String(orders.completed || 0), w) + '\n', 'ascii'));
    buffers.push(Buffer.from(formatLine('Subtotal:', ((orders.subtotalCents || 0) / 100).toFixed(0), w) + '\n', 'ascii'));
    buffers.push(Buffer.from(formatLine('Tax:', ((orders.taxCents || 0) / 100).toFixed(0), w) + '\n', 'ascii'));
    buffers.push(COMMANDS.BOLD_ON);
    buffers.push(Buffer.from(formatLine('TOTAL REVENUE:', ((orders.totalRevenueCents || 0) / 100).toFixed(0), w) + '\n', 'ascii'));
    buffers.push(COMMANDS.BOLD_OFF);
    buffers.push(Buffer.from(line('-') + '\n\n', 'ascii'));
    
    // Payments by Method
    buffers.push(COMMANDS.BOLD_ON);
    buffers.push(Buffer.from('PAYMENTS\n', 'ascii'));
    buffers.push(COMMANDS.BOLD_OFF);
    const payments = reportData.payments || {};
    let hasPayments = false;
    ['cash', 'card', 'qr', 'other'].forEach(method => {
        if (payments[method] && payments[method].count > 0) {
            hasPayments = true;
            const total = ((payments[method].totalCents || 0) / 100).toFixed(0);
            const count = payments[method].count || 0;
            buffers.push(Buffer.from(formatLine(`${method.charAt(0).toUpperCase() + method.slice(1)} (${count}):`, total, w) + '\n', 'ascii'));
        }
    });
    if (!hasPayments) {
        buffers.push(Buffer.from('No payments recorded\n', 'ascii'));
    }
    buffers.push(Buffer.from(line('-') + '\n\n', 'ascii'));
    
    // Tables Served
    buffers.push(Buffer.from(formatLine('Tables Served:', String(reportData.tablesServed || 0), w) + '\n', 'ascii'));
    buffers.push(Buffer.from(line('-') + '\n\n', 'ascii'));
    
    // Top Selling Items
    buffers.push(COMMANDS.BOLD_ON);
    buffers.push(Buffer.from('TOP ITEMS\n', 'ascii'));
    buffers.push(COMMANDS.BOLD_OFF);
    const topItems = reportData.topItems || [];
    if (topItems.length > 0) {
        topItems.slice(0, 5).forEach((item, i) => {
            const revenue = ((item.revenueCents || 0) / 100).toFixed(0);
            buffers.push(Buffer.from(formatLine(`${i + 1}. ${item.name}`, `Qty:${item.quantity}`, w) + '\n', 'ascii'));
            buffers.push(Buffer.from(formatLine('   Revenue:', revenue, w) + '\n', 'ascii'));
        });
    } else {
        buffers.push(Buffer.from('No items sold\n', 'ascii'));
    }
    
    // Footer
    buffers.push(Buffer.from('\n' + line('=') + '\n', 'ascii'));
    buffers.push(Buffer.from(`Printed: ${new Date().toLocaleString()}\n`, 'ascii'));
    
    // Feed and cut
    buffers.push(COMMANDS.FEED_LINES(4));
    buffers.push(COMMANDS.CUT);
    
    return Buffer.concat(buffers);
}

/**
 * Send raw data to printer using Windows raw printing via PowerShell
 */
function sendToPrinter(buffer, printerName = PRINTER_CONFIG.name) {
    return new Promise((resolve, reject) => {
        // Write buffer to temp file
        const tempFile = path.join(os.tmpdir(), `pos_receipt_${Date.now()}.bin`);
        const scriptFile = path.join(os.tmpdir(), `pos_print_${Date.now()}.ps1`);
        fs.writeFileSync(tempFile, buffer);
        
        // PowerShell script to send raw data to printer
        const psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrinterAPI {
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFO pDocInfo);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
}
'@
$printerName = "${printerName}"
$hPrinter = [IntPtr]::Zero
[RawPrinterAPI]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero) | Out-Null
if ($hPrinter -eq [IntPtr]::Zero) {
    Write-Error "Failed to open printer"
    exit 1
}
$di = New-Object RawPrinterAPI+DOCINFO
$di.pDocName = "POS Receipt"
$di.pDataType = "RAW"
[RawPrinterAPI]::StartDocPrinter($hPrinter, 1, [ref]$di) | Out-Null
[RawPrinterAPI]::StartPagePrinter($hPrinter) | Out-Null
$bytes = [System.IO.File]::ReadAllBytes("${tempFile.replace(/\\/g, '\\')}")
$ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
$written = 0
[RawPrinterAPI]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written) | Out-Null
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
[RawPrinterAPI]::EndPagePrinter($hPrinter) | Out-Null
[RawPrinterAPI]::EndDocPrinter($hPrinter) | Out-Null
[RawPrinterAPI]::ClosePrinter($hPrinter) | Out-Null
Write-Output "OK:$written"
`;
        
        // Write script to temp file
        fs.writeFileSync(scriptFile, psScript, 'utf8');
        
        // Execute PowerShell script file
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptFile}"`, 
            { timeout: 10000 },
            (error, stdout, stderr) => {
                // Cleanup temp files
                try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
                try { fs.unlinkSync(scriptFile); } catch (e) { /* ignore */ }
                
                if (error) {
                    console.error('Printer error:', stderr || error.message);
                    reject(new Error(`Print failed: ${stderr || error.message}`));
                    return;
                }
                
                if (stdout.includes('OK:')) {
                    const bytes = stdout.match(/OK:(\d+)/)?.[1] || '0';
                    console.log(`Printed ${bytes} bytes to ${printerName}`);
                    resolve({ success: true, bytesWritten: parseInt(bytes) });
                } else {
                    reject(new Error('Print command did not complete successfully'));
                }
            }
        );
    });
}

/**
 * Print an order receipt
 */
async function printReceipt(order, businessName) {
    const buffer = await buildReceiptBuffer(order, businessName);
    return sendToPrinter(buffer);
}

/**
 * Print a kitchen ticket (no QR, simplified format)
 */
async function printKitchenTicket(order, businessName) {
    const buffer = await buildKitchenTicketBuffer(order, businessName);
    return sendToPrinter(buffer);
}

/**
 * Print daily report
 */
async function printDailyReport(reportData, businessName) {
    const buffer = buildDailyReportBuffer(reportData, businessName);
    return sendToPrinter(buffer);
}

/**
 * Print raw text with auto-cut
 */
async function printRawText(text) {
    const buffers = [
        COMMANDS.INIT,
        textBuffer(text + '\r\n\r\n\r\n'),
        COMMANDS.CUT
    ];
    return sendToPrinter(Buffer.concat(buffers));
}

/**
 * Get printer status
 */
function getPrinterStatus(printerName = PRINTER_CONFIG.name) {
    return new Promise((resolve) => {
        exec(`powershell -NoProfile -Command "Get-Printer -Name '${printerName}' | Select-Object Name, PrinterStatus | ConvertTo-Json"`,
            { timeout: 5000 },
            (error, stdout) => {
                if (error) {
                    resolve({ available: false, error: error.message });
                    return;
                }
                try {
                    const info = JSON.parse(stdout);
                    resolve({
                        available: true,
                        name: info.Name,
                        status: info.PrinterStatus === 0 ? 'Ready' : 
                               info.PrinterStatus === 1 ? 'Paused' :
                               info.PrinterStatus === 3 ? 'Idle' : 'Unknown'
                    });
                } catch (e) {
                    resolve({ available: false, error: 'Failed to parse printer info' });
                }
            }
        );
    });
}

module.exports = {
    PRINTER_CONFIG,
    COMMANDS,
    printReceipt,
    printKitchenTicket,
    printDailyReport,
    printRawText,
    getPrinterStatus,
    buildReceiptBuffer,
    buildKitchenTicketBuffer,
    buildDailyReportBuffer,
    sendToPrinter
};
