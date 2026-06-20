/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { format } from 'date-fns';
import { Order, RestaurantSettings } from '../types';

export const KitchenTicket = React.forwardRef<HTMLDivElement, { order: Order; settings: RestaurantSettings; kotNumber?: number }>(
  ({ order, settings, kotNumber = 1 }, ref) => {
    return (
      <div ref={ref} className="p-4 text-black bg-white max-w-[300px] mx-auto print:block kot-print-container">
        <style>{`
          @media print {
            @page { 
              size: 80mm auto; 
              margin: 2mm 0mm 2mm 2mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            .kot-print-container {
              width: 70mm !important;
              max-width: 70mm !important;
              font-family: Arial, Helvetica, sans-serif !important;
              font-size: 12px !important;
              font-weight: bold !important;
              line-height: 1.3 !important;
              background: #ffffff !important;
              color: #000000 !important;
              padding: 0mm 5mm 0mm 1mm !important;
              margin: 0 !important;
            }
            .kot-print-container * {
              color: #000000 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              font-weight: bold !important;
              background: transparent !important;
            }
            .kot-text-heavy {
              font-size: 15px !important;
              font-weight: 900 !important;
            }
            .kot-text-normal {
              font-size: 12px !important;
              font-weight: bold !important;
            }
            .kot-logo {
              width: auto !important;
              height: ${settings.logoHeightKOT || 15}mm !important;
              max-width: 30mm !important;
              object-fit: contain !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}</style>
        
        {/* HEADER SECTION */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '4mm',
          width: '100%'
        }}>
          <div style={{ flex: '0 0 auto' }}>
            {settings.logoDataURL ? (
              <img 
                src={settings.logoDataURL}
                alt="Restaurant Logo"
                className="kot-logo"
                style={{
                  height: `${settings.logoHeightKOT || 15}mm`,
                  width: 'auto',
                  maxWidth: '30mm',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <div className="kot-text-normal" style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'left' }}>
                {settings.name}
              </div>
            )}
          </div>
          <div style={{ flex: '1 1 auto' }} />
          <div style={{ 
            flex: '0 0 auto',
            textAlign: 'right',
            fontSize: '14px',
            fontWeight: 'bold'
          }} className="kot-text-heavy">
            KOT #{kotNumber}
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #000',
          margin: '2mm 0'
        }}></div>

        {/* METADATA BLOCK */}
        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', fontWeight: 'bold' }}>
          <tbody>
            <tr>
              <td style={{ width: '40%', padding: '1px 0', fontWeight: 'bold' }}>Order #:</td>
              <td style={{ width: '60%', textAlign: 'right', fontWeight: 'bold' }}>{order.orderNumber}</td>
            </tr>
            <tr>
              <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Date:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{format(order.createdAt, 'dd/MM/yyyy')}</td>
            </tr>
            <tr>
              <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Time:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{format(order.createdAt, 'HH:mm:ss')}</td>
            </tr>
            {settings.showOrderTypeOnKOT && (
              <tr>
                <td style={{ padding: '3px 0 1px 0', borderTop: '1px dashed #000000', fontWeight: 'bold' }}>Type:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '3px 0 1px 0', borderTop: '1px dashed #000000', textTransform: 'uppercase' }}>{order.type}</td>
              </tr>
            )}
            {order.tableNumber && (
              <tr>
                <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Table:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>#{order.tableNumber}</td>
              </tr>
            )}
            {settings.showCustomerNameOnKOT && order.customerName && (
              <tr>
                <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Customer:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.customerName}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ fontSize: '12px', margin: '4px 0', fontWeight: 'bold' }}>==============================</div>

        {/* KOT ITEMS LIST */}
        <div style={{ width: '100%' }}>
          {order.items.map((item, idx) => (
            <div key={idx} style={{ width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '20%', fontWeight: '900', fontSize: '15px', verticalAlign: 'top' }}>{item.quantity}x</td>
                    <td style={{ width: '80%', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', verticalAlign: 'top', paddingLeft: '2px' }}>{item.name}</td>
                  </tr>
                </tbody>
              </table>

              {/* Item Level Notes */}
              {item.notes && (
                <div style={{ paddingLeft: '22px', fontSize: '11px', fontWeight: 'bold', marginTop: '1px' }}>
                  * NOTE: {item.notes}
                </div>
              )}

              {/* Modifiers List */}
              {(item.modifiers || []).length > 0 && (
                <div style={{ paddingLeft: '22px', marginTop: '1px' }}>
                  {item.modifiers?.map((m: any, mIdx: number) => (
                    <div key={mIdx} style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      → {m.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Deal Sub-Components Breakdown */}
              {item.isDeal && item.dealComponents && (
                <div style={{ paddingLeft: '22px', marginTop: '3px', borderLeft: '2px dashed #000000', marginLeft: '4px' }}>
                  {item.dealComponents.map((comp, cIdx) => (
                    <div key={cIdx} style={{ marginBottom: '3px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>• {comp.componentName}</div>
                      {comp.modifiers && comp.modifiers.length > 0 && (
                        <div style={{ paddingLeft: '10px' }}>
                          {comp.modifiers.map((m: any, mIdx: number) => (
                            <div key={mIdx} style={{ fontSize: '10px', fontWeight: 'bold' }}>— {m.label}</div>
                          ))}
                        </div>
                      )}
                      {comp.notes && (
                        <div style={{ paddingLeft: '10px', fontSize: '10px', fontStyle: 'italic', fontWeight: 'bold' }}>
                          Note: {comp.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Strict Separator Block Requirement */}
              {idx < order.items.length - 1 && (
                <div style={{ fontSize: '12px', margin: '4px 0', textAlign: 'center', fontWeight: 'bold', width: '100%', clear: 'both' }}>
                  ------------------------------
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: '12px', margin: '4px 0', fontWeight: 'bold' }}>==============================</div>
        
        {/* FOOTER TOTALS */}
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            TOTAL ITEMS: {order.items.reduce((acc, i) => acc + i.quantity, 0)}
          </div>
        </div>
      </div>
    );
  }
);

interface DeltaSections {
  added: any[];
  increased: { item: any; deltaQty: number }[];
  noteChanged: { item: any; oldNote: string; newNote: string }[];
  cancelled: any[];
}

export const DeltaKitchenTicket = React.forwardRef<HTMLDivElement, { 
  order: Order; 
  settings: RestaurantSettings;
  kotNumber: number;
  totalKots: number;
  lastSentAt?: number;
  deltas?: DeltaSections | null;
}>(({ order, settings, kotNumber, totalKots, lastSentAt, deltas }, ref) => {
  return (
    <div ref={ref} className="p-4 text-black bg-white max-w-[300px] mx-auto print:block kot-print-container">
      <style>{`
        @media print {
          @page { 
            size: 80mm auto; 
            margin: 2mm 0mm 2mm 2mm;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          .kot-print-container {
            width: 70mm !important;
            max-width: 70mm !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 12px !important;
            font-weight: bold !important;
            line-height: 1.3 !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0mm 5mm 0mm 1mm !important;
            margin: 0 !important;
          }
          .kot-print-container * {
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-weight: bold !important;
            background: transparent !important;
          }
        `}</style>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '14px', fontWeight: '900' }}>*** UPDATED ORDER ***</div>
          <div style={{ fontSize: '11px', marginTop: '2px', fontWeight: 'bold' }}>{settings.name}</div>
          <div style={{ fontSize: '12px', margin: '4px 0', fontWeight: 'bold' }}>──────────────────────────────</div>
        </div>

        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', fontWeight: 'bold' }}>
          <tbody>
            <tr>
              <td style={{ width: '40%', padding: '1px 0', fontWeight: 'bold' }}>Order #:</td>
              <td style={{ width: '60%', textAlign: 'right', fontWeight: 'bold' }}>{order.orderNumber}</td>
            </tr>
            <tr>
              <td style={{ padding: '1px 0', fontWeight: 'bold' }}>KOT #:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{kotNumber} of {totalKots}</td>
            </tr>
            {order.tableNumber && (
              <tr>
                <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Table:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>#{order.tableNumber}</td>
              </tr>
            )}
            {order.customerName && (
              <tr>
                <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Customer:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.customerName}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ fontSize: '12px', margin: '4px 0', fontWeight: 'bold' }}>==============================</div>

        <div style={{ width: '100%' }}>
          {order.items.map((item, idx) => (
            <div key={idx} style={{ width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '20%', fontWeight: '900', fontSize: '15px', verticalAlign: 'top' }}>{item.quantity}x</td>
                    <td style={{ width: '80%', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', verticalAlign: 'top', paddingLeft: '2px' }}>{item.name}</td>
                  </tr>
                </tbody>
              </table>

              {item.notes && (
                <div style={{ paddingLeft: '22px', fontSize: '11px', fontWeight: 'bold', marginTop: '1px' }}>
                  * NOTE: {item.notes}
                </div>
              )}

              {(item.modifiers || []).length > 0 && (
                <div style={{ paddingLeft: '22px', marginTop: '1px' }}>
                  {item.modifiers?.map((m: any, mIdx: number) => (
                    <div key={mIdx} style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      → {m.label}
                    </div>
                  ))}
                </div>
              )}

              {item.isDeal && item.dealComponents && (
                <div style={{ paddingLeft: '22px', marginTop: '3px', borderLeft: '2px dashed #000000', marginLeft: '4px' }}>
                  {item.dealComponents.map((comp, cIdx) => (
                    <div key={cIdx} style={{ marginBottom: '3px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>• {comp.componentName}</div>
                    </div>
                  ))}
                </div>
              )}

              {idx < order.items.length - 1 && (
                <div style={{ fontSize: '12px', margin: '4px 0', textAlign: 'center', fontWeight: 'bold', width: '100%' }}>
                  ------------------------------
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: '12px', margin: '4px 0', fontWeight: 'bold' }}>==============================</div>
        
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>
          <div style={{ fontWeight: '900' }}>** REPLACE PREVIOUS KOT **</div>
          {lastSentAt && <div style={{ fontSize: '10px', marginTop: '2px' }}>PREVIOUS SENT AT: {format(lastSentAt, 'HH:mm')}</div>}
        </div>
    </div>
  );
});

export const CustomerReceipt = React.forwardRef<HTMLDivElement, { order: Order; settings: RestaurantSettings }>(
  ({ order, settings }, ref) => {
    return (
      <div ref={ref} className="p-4 text-black bg-white max-w-[310px] mx-auto print:block receipt-print-container">
        <style>{`
          @media print {
            @page {
              size: 80mm auto;
              margin: 0mm 0mm 0mm 2mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            .receipt-print-container {
              width: 70mm !important;
              max-width: 70mm !important;
              padding: 4mm 5mm 8mm 1mm !important;
              margin: 0 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              background: #ffffff !important;
              color: #000000 !important;
              display: block !important;
              box-sizing: border-box !important;
            }
            .receipt-print-container, .receipt-print-container * {
              color: #000000 !important;
              background: transparent !important;
              font-family: Arial, Helvetica, sans-serif !important;
              box-sizing: border-box !important;
              position: static !important;
              float: none !important;
              font-weight: bold !important;
              -webkit-font-smoothing: none !important;
              font-smoothing: none !important;
            }
            .receipt-strong-header {
              font-size: 16px !important;
              font-weight: 900 !important;
              line-height: 1.2 !important;
            }
            .receipt-bold-meta {
              font-size: 12px !important;
              font-weight: bold !important;
              line-height: 1.3 !important;
            }
            .receipt-bold-item {
              font-size: 13px !important;
              font-weight: 900 !important;
              line-height: 1.3 !important;
            }
            .receipt-bold-sub {
              font-size: 11px !important;
              font-weight: bold !important;
              line-height: 1.2 !important;
            }
            .receipt-bold-totals {
              font-size: 12px !important;
              font-weight: bold !important;
            }
            .receipt-bold-grand {
              font-size: 15px !important;
              font-weight: 900 !important;
            }
            .receipt-plain-divider {
              width: 100% !important;
              font-size: 12px !important;
              line-height: 1.0 !important;
              font-weight: bold !important;
              text-align: center !important;
              margin: 4px 0 !important;
            }
            .receipt-logo {
              width: auto !important;
              height: ${settings.logoHeightReceipt || 20}mm !important;
              max-width: 70mm !important;
              display: block !important;
              margin: 0 auto 4mm auto !important;
              object-fit: contain !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}</style>

        {/* HEADER BRANDING SUITE */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          {settings.logoDataURL && (
            <>
              <img 
                src={settings.logoDataURL}
                alt="Restaurant Logo"
                className="receipt-logo"
                style={{
                  width: 'auto',
                  height: `${settings.logoHeightReceipt || 20}mm`,
                  maxWidth: '70mm',
                  display: 'block',
                  margin: '0 auto 4mm auto',
                  objectFit: 'contain'
                }}
              />
              <div style={{ height: '2mm' }} />
            </>
          )}
          <div className="receipt-strong-header" style={{ fontWeight: 'bold', fontSize: '16px' }}>{settings.name}</div>
          <div className="receipt-bold-meta" style={{ fontSize: '11px', marginTop: '2px' }}>{settings.address}</div>
          {settings.phone && <div className="receipt-bold-meta" style={{ fontSize: '11px' }}>Phone: {settings.phone}</div>}
          
          <div className="receipt-plain-divider">==============================</div>
          <div className="receipt-bold-meta" style={{ fontWeight: 'bold', letterSpacing: '0.5px', fontSize: '11px', textTransform: 'uppercase' }}>
            {settings.receiptHeader || 'WELCOME TO OUR RESTAURANT'}
          </div>
          <div className="receipt-plain-divider">==============================</div>
        </div>
        
        {/* CORE INVOICE TRANSACTION META */}
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '2px 0' }}>
          <tbody>
            <tr className="receipt-bold-meta">
              <td style={{ width: '40%', padding: '1px 0', fontWeight: 'bold' }}>Order #:</td>
              <td style={{ width: '60%', textAlign: 'right', fontWeight: 'bold' }}>{order.orderNumber}</td>
            </tr>
            <tr className="receipt-bold-meta">
              <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Date:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{format(order.createdAt, 'dd/MM/yyyy')}</td>
            </tr>
            <tr className="receipt-bold-meta">
              <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Time:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{format(order.createdAt, 'HH:mm:ss')}</td>
            </tr>
            <tr className="receipt-bold-meta">
              <td style={{ padding: '3px 0 1px 0', borderTop: '1px dashed #000000', fontWeight: 'bold' }}>Type:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', textTransform: 'uppercase', padding: '3px 0 1px 0', borderTop: '1px dashed #000000' }}>
                {order.type}
              </td>
            </tr>
            {order.tableNumber && (
              <tr className="receipt-bold-meta">
                <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Table:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>#{order.tableNumber}</td>
              </tr>
            )}
            {order.customerName && (
              <tr className="receipt-bold-meta">
                <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Customer:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.customerName}</td>
              </tr>
            )}
            <tr className="receipt-bold-meta">
              <td style={{ padding: '1px 0', fontWeight: 'bold' }}>Cashier:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.cashierName || 'TERMINAL-01'}</td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-plain-divider">==============================</div>
        
        {/* CUSTOM INVOICE PRICING ENTRIES TABLE */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #000000' }}>
              <th style={{ textAlign: 'left', fontSize: '11px', fontWeight: 'bold', paddingBottom: '4px', width: '55%' }}>ITEM</th>
              <th style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', paddingBottom: '4px', width: '15%' }}>QTY</th>
              <th style={{ textAlign: 'right', fontSize: '11px', fontWeight: 'bold', paddingBottom: '4px', width: '30%' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <React.Fragment key={idx}>
                {/* Product Identifier Block Line */}
                <tr className="receipt-bold-item">
                  <td style={{ textAlign: 'left', width: '55%', fontWeight: '900', verticalAlign: 'top', paddingTop: '4px' }}>{item.name}</td>
                  <td style={{ textAlign: 'center', width: '15%', fontWeight: '900', verticalAlign: 'top', paddingTop: '4px' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', width: '30%', fontWeight: '900', verticalAlign: 'top', paddingTop: '4px' }}>
                    {settings.currency}{((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                  </td>
                </tr>

                {/* Plain Text Context Instructions */}
                {item.notes && (
                  <tr className="receipt-bold-sub">
                    <td colSpan={3} style={{ paddingLeft: '10px', fontWeight: 'bold', paddingTop: '1px' }}>
                      * Note: {item.notes}
                    </td>
                  </tr>
                )}

                {/* Sub-item Modifier Layout Parameters */}
                {(item.modifiers || []).length > 0 && item.modifiers?.map((m: any, mIdx: number) => (
                  <tr key={`mod-${mIdx}`} className="receipt-bold-sub">
                    <td colSpan={2} style={{ paddingLeft: '10px', fontWeight: 'bold' }}>+ {m.label}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {m.additionalPrice > 0 ? `${settings.currency}${m.additionalPrice.toFixed(2)}` : ''}
                    </td>
                  </tr>
                ))}

                {/* Structured Multi-item Deals Nested Content Array Block */}
                {item.isDeal && item.dealComponents && (
                  <tr className="receipt-bold-sub">
                    <td colSpan={3} style={{ paddingLeft: '10px', paddingTop: '3px' }}>
                      <div style={{ borderLeft: '2px dashed #000000', paddingLeft: '6px' }}>
                        {item.dealComponents.map((comp, cIdx) => (
                          <div key={cIdx} style={{ marginBottom: '3px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '11px' }}>• {comp.componentName}</div>
                            {comp.modifiers && comp.modifiers.length > 0 && (
                              <div style={{ paddingLeft: '10px' }}>
                                {comp.modifiers.map((m: any, mIdx: number) => (
                                  <div key={mIdx} style={{ fontSize: '10px', fontWeight: 'bold' }}>— {m.label}</div>
                                ))}
                              </div>
                            )}
                            {comp.notes && (
                              <div style={{ paddingLeft: '10px', fontSize: '10px', fontStyle: 'italic', fontWeight: 'bold' }}>
                                Note: {comp.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}

                {/* Explicit Structural Dashed Item Separation Matrix Requirement */}
                {idx < order.items.length - 1 && (
                  <tr>
                    <td colSpan={3}>
                      <div className="receipt-plain-divider">------------------------------</div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        <div className="receipt-plain-divider">==============================</div>
        
        {/* TOTALS VALUE MATRIX */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr className="receipt-bold-totals">
              <td style={{ padding: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>Subtotal:</td>
              <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>{settings.currency}{(order.subtotal || 0).toFixed(2)}</td>
            </tr>
            {order.discountAmount !== undefined && order.discountAmount > 0 && (
              <tr className="receipt-bold-totals">
                <td style={{ padding: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>
                  Discount {order.discountType === 'percent' ? `(${order.discountValue}%)` : ''}:
                </td>
                <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>-{settings.currency}{(order.discountAmount || 0).toFixed(2)}</td>
              </tr>
            )}
            {order.deliveryCharge !== undefined && order.deliveryCharge > 0 && (
              <tr className="receipt-bold-totals">
                <td style={{ padding: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>{settings.deliveryChargeLabel || 'Delivery Fee'}:</td>
                <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>{settings.currency}{(order.deliveryCharge || 0).toFixed(2)}</td>
              </tr>
            )}
            {settings.showTaxLine && (
              <tr className="receipt-bold-totals">
                <td style={{ padding: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>Tax ({settings.taxPercentage}%):</td>
                <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 'bold', fontSize: '12px' }}>{settings.currency}{(order.taxAmount || 0).toFixed(2)}</td>
              </tr>
            )}
            
            {/* Grand Total Execution Matrix */}
            <tr>
              <td className="receipt-bold-grand" style={{ borderTop: '1px dashed #000000', padding: '5px 0', fontWeight: '900', fontSize: '14px' }}>GRAND TOTAL:</td>
              <td className="receipt-bold-grand" style={{ borderTop: '1px dashed #000000', padding: '5px 0', textAlign: 'right', fontWeight: '900', fontSize: '15px' }}>
                {settings.currency}{(order.total || 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-plain-divider">==============================</div>

        {/* COMPONENT BILL FOOTER INFORMATION */}
        <div style={{ textAlign: 'center', width: '100%', marginTop: '4px' }}>
          {settings.receiptFooter && (
            <div className="receipt-bold-meta" style={{ whiteSpace: 'pre-line', fontWeight: 'bold', fontSize: '11px', lineHeight: '1.3' }}>
              {settings.receiptFooter}
            </div>
          )}
          <div className="receipt-bold-meta" style={{ fontWeight: 'bold', marginTop: '4px', letterSpacing: '1px', fontSize: '11px' }}>
            THANK YOU FOR VISITING!
          </div>
          
          <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '12px', borderTop: '1px solid #000000', paddingTop: '3px' }}>
            Powered by Saynz • 0347-1887181
          </div>
        </div>
      </div>
    );
  }
);