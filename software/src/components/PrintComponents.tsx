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
              margin: 2mm 2mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            .kot-print-container {
              width: 74mm !important;
              max-width: 74mm !important;
              font-family: Arial, Helvetica, sans-serif !important;
              font-size: 14px !important;
              font-weight: bold !important;
              line-height: 1.4 !important;
              background: #ffffff !important;
              color: #000000 !important;
              padding: 0mm 2mm !important;
              margin: 0 auto !important;
            }
            .kot-print-container * {
              color: #000000 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              font-weight: bold !important;
              background: transparent !important;
            }
            .kot-text-heavy {
              font-size: 17px !important;
              font-weight: 900 !important;
            }
            .kot-text-normal {
              font-size: 14px !important;
              font-weight: bold !important;
            }
          }
        `}</style>
        
        {/* HEADER SECTION */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div className="kot-text-heavy" style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '2px' }}>KOT #{kotNumber}</div>
          <div className="kot-text-normal" style={{ fontSize: '13px', marginTop: '1px' }}>{settings.name}</div>
          <div style={{ fontSize: '14px', margin: '4px 0', fontWeight: 'bold' }}>────────────────────────────────</div>
        </div>

        {/* METADATA BLOCK */}
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', fontWeight: 'bold' }}>
          <tbody>
            <tr>
              <td style={{ width: '40%', padding: '2px 0', fontWeight: 'bold' }}>Order #:</td>
              <td style={{ width: '60%', textAlign: 'right', fontWeight: 'bold' }}>{order.orderNumber}</td>
            </tr>
            <tr>
              <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Date:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{format(order.createdAt, 'dd/MM/yyyy')}</td>
            </tr>
            <tr>
              <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Time:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{format(order.createdAt, 'HH:mm:ss')}</td>
            </tr>
            {settings.showOrderTypeOnKOT && (
              <tr>
                <td style={{ padding: '4px 0 2px 0', borderTop: '1px dashed #000000', fontWeight: 'bold' }}>Type:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '4px 0 2px 0', borderTop: '1px dashed #000000', textTransform: 'uppercase' }}>{order.type}</td>
              </tr>
            )}
            {order.tableNumber && (
              <tr>
                <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Table:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>#{order.tableNumber}</td>
              </tr>
            )}
            {settings.showCustomerNameOnKOT && order.customerName && (
              <tr>
                <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Customer:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.customerName}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ fontSize: '14px', margin: '6px 0', fontWeight: 'bold' }}>================================</div>

        {/* KOT ITEMS LIST */}
        <div style={{ width: '100%' }}>
          {order.items.map((item, idx) => (
            <div key={idx} style={{ width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '20%', fontWeight: '900', fontSize: '18px', verticalAlign: 'top' }}>{item.quantity}x</td>
                    <td style={{ width: '80%', fontWeight: '900', fontSize: '16px', textTransform: 'uppercase', verticalAlign: 'top', paddingLeft: '4px' }}>{item.name}</td>
                  </tr>
                </tbody>
              </table>

              {/* Item Level Notes */}
              {item.notes && (
                <div style={{ paddingLeft: '28px', fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>
                  * NOTE: {item.notes}
                </div>
              )}

              {/* Modifiers List */}
              {(item.modifiers || []).length > 0 && (
                <div style={{ paddingLeft: '28px', marginTop: '2px' }}>
                  {item.modifiers?.map((m: any, mIdx: number) => (
                    <div key={mIdx} style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      → {m.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Deal Sub-Components Breakdown */}
              {item.isDeal && item.dealComponents && (
                <div style={{ paddingLeft: '28px', marginTop: '4px', borderLeft: '2px dashed #000000', marginLeft: '6px' }}>
                  {item.dealComponents.map((comp, cIdx) => (
                    <div key={cIdx} style={{ marginBottom: '4px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>• {comp.componentName}</div>
                      {comp.modifiers && comp.modifiers.length > 0 && (
                        <div style={{ paddingLeft: '12px' }}>
                          {comp.modifiers.map((m: any, mIdx: number) => (
                            <div key={mIdx} style={{ fontSize: '12px', fontWeight: 'bold' }}>— {m.label}</div>
                          ))}
                        </div>
                      )}
                      {comp.notes && (
                        <div style={{ paddingLeft: '12px', fontSize: '12px', fontStyle: 'italic', fontWeight: 'bold' }}>
                          Note: {comp.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Strict Separator Block Requirement */}
              {idx < order.items.length - 1 && (
                <div style={{ fontSize: '14px', margin: '6px 0', textAlign: 'center', fontWeight: 'bold', width: '100%', clear: 'both' }}>
                  --------------------------------
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: '14px', margin: '6px 0', fontWeight: 'bold' }}>================================</div>
        
        {/* FOOTER TOTALS */}
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
          <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>
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
            margin: 2mm 2mm;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          .kot-print-container {
            width: 74mm !important;
            max-width: 74mm !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 14px !important;
            font-weight: bold !important;
            line-height: 1.4 !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0mm 2mm !important;
            margin: 0 auto !important;
          }
          .kot-print-container * {
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-weight: bold !important;
            background: transparent !important;
          }
        `}</style>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '16px', fontWeight: '900' }}>*** UPDATED ORDER ***</div>
          <div style={{ fontSize: '13px', marginTop: '2px', fontWeight: 'bold' }}>{settings.name}</div>
          <div style={{ fontSize: '14px', margin: '4px 0', fontWeight: 'bold' }}>────────────────────────────────</div>
        </div>

        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', fontWeight: 'bold' }}>
          <tbody>
            <tr>
              <td style={{ width: '40%', padding: '2px 0', fontWeight: 'bold' }}>Order #:</td>
              <td style={{ width: '60%', textAlign: 'right', fontWeight: 'bold' }}>{order.orderNumber}</td>
            </tr>
            <tr>
              <td style={{ padding: '2px 0', fontWeight: 'bold' }}>KOT #:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{kotNumber} of {totalKots}</td>
            </tr>
            {order.tableNumber && (
              <tr>
                <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Table:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>#{order.tableNumber}</td>
              </tr>
            )}
            {order.customerName && (
              <tr>
                <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Customer:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.customerName}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ fontSize: '14px', margin: '6px 0', fontWeight: 'bold' }}>================================</div>

        <div style={{ width: '100%' }}>
          {order.items.map((item, idx) => (
            <div key={idx} style={{ width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '20%', fontWeight: '900', fontSize: '18px', verticalAlign: 'top' }}>{item.quantity}x</td>
                    <td style={{ width: '80%', fontWeight: '900', fontSize: '16px', textTransform: 'uppercase', verticalAlign: 'top', paddingLeft: '4px' }}>{item.name}</td>
                  </tr>
                </tbody>
              </table>

              {item.notes && (
                <div style={{ paddingLeft: '28px', fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>
                  * NOTE: {item.notes}
                </div>
              )}

              {(item.modifiers || []).length > 0 && (
                <div style={{ paddingLeft: '28px', marginTop: '2px' }}>
                  {item.modifiers?.map((m: any, mIdx: number) => (
                    <div key={mIdx} style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      → {m.label}
                    </div>
                  ))}
                </div>
              )}

              {item.isDeal && item.dealComponents && (
                <div style={{ paddingLeft: '28px', marginTop: '4px', borderLeft: '2px dashed #000000', marginLeft: '6px' }}>
                  {item.dealComponents.map((comp, cIdx) => (
                    <div key={cIdx} style={{ marginBottom: '4px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>• {comp.componentName}</div>
                    </div>
                  ))}
                </div>
              )}

              {idx < order.items.length - 1 && (
                <div style={{ fontSize: '14px', margin: '6px 0', textAlign: 'center', fontWeight: 'bold', width: '100%' }}>
                  --------------------------------
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: '14px', margin: '6px 0', fontWeight: 'bold' }}>================================</div>
        
        <div style={{ textalign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
          <div style={{ fontWeight: '900' }}>** REPLACE PREVIOUS KOT **</div>
          {lastSentAt && <div style={{ fontSize: '11px', marginTop: '2px' }}>PREVIOUS SENT AT: {format(lastSentAt, 'HH:mm')}</div>}
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
              margin: 0mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            .receipt-print-container {
              width: 74mm !important;
              max-width: 74mm !important;
              padding: 4mm 2mm 8mm 2mm !important;
              margin: 0 auto !important;
              font-family: Arial, Helvetica, sans-serif !important;
              background: #ffffff !important;
              color: #000000 !important;
              display: block !important;
              box-sizing: border-box !important;
            }
            /* Explicit parameters for strong graphic layouts */
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
              font-size: 19px !important;
              font-weight: 900 !important;
              line-height: 1.2 !important;
            }
            .receipt-bold-meta {
              font-size: 14px !important;
              font-weight: bold !important;
              line-height: 1.4 !important;
            }
            .receipt-bold-item {
              font-size: 15px !important;
              font-weight: 900 !important;
              line-height: 1.4 !important;
            }
            .receipt-bold-sub {
              font-size: 13px !important;
              font-weight: bold !important;
              line-height: 1.3 !important;
            }
            .receipt-bold-totals {
              font-size: 14px !important;
              font-weight: bold !important;
            }
            .receipt-bold-grand {
              font-size: 18px !important;
              font-weight: 900 !important;
            }
            .receipt-plain-divider {
              width: 100% !important;
              font-size: 14px !important;
              line-height: 1.0 !important;
              font-weight: bold !important;
              text-align: center !important;
              margin: 4px 0 !important;
            }
          }
        `}</style>

        {/* HEADER BRANDING SUITE */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div className="receipt-strong-header" style={{ fontWeight: 'bold', fontSize: '18px' }}>{settings.name}</div>
          <div className="receipt-bold-meta" style={{ fontSize: '13px', marginTop: '2px' }}>{settings.address}</div>
          {settings.phone && <div className="receipt-bold-meta" style={{ fontSize: '13px' }}>Phone: {settings.phone}</div>}
          
          <div className="receipt-plain-divider">================================</div>
          <div className="receipt-bold-meta" style={{ fontWeight: 'bold', letterSpacing: '0.5px', fontSize: '13px', textTransform: 'uppercase' }}>
            {settings.receiptHeader || 'WELCOME TO OUR RESTAURANT'}
          </div>
          <div className="receipt-plain-divider">================================</div>
        </div>
        
        {/* CORE INVOICE TRANSACTION META */}
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '2px 0' }}>
          <tbody>
            <tr className="receipt-bold-meta">
              <td style={{ width: '40%', padding: '2px 0', fontWeight: 'bold' }}>Order #:</td>
              <td style={{ width: '60%', textAlign: 'right', fontWeight: 'bold' }}>{order.orderNumber}</td>
            </tr>
            <tr className="receipt-bold-meta">
              <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Date:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{format(order.createdAt, 'dd/MM/yyyy')}</td>
            </tr>
            <tr className="receipt-bold-meta">
              <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Time:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{format(order.createdAt, 'HH:mm:ss')}</td>
            </tr>
            <tr className="receipt-bold-meta">
              <td style={{ padding: '4px 0 2px 0', borderTop: '1px dashed #000000', fontWeight: 'bold' }}>Type:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', textTransform: 'uppercase', padding: '4px 0 2px 0', borderTop: '1px dashed #000000' }}>
                {order.type}
              </td>
            </tr>
            {order.tableNumber && (
              <tr className="receipt-bold-meta">
                <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Table:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>#{order.tableNumber}</td>
              </tr>
            )}
            {order.customerName && (
              <tr className="receipt-bold-meta">
                <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Customer:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.customerName}</td>
              </tr>
            )}
            <tr className="receipt-bold-meta">
              <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Cashier:</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{order.cashierName || '—'}</td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-plain-divider">================================</div>
        
        {/* CUSTOM INVOICE PRICING ENTRIES TABLE */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #000000' }}>
              <th style={{ textAlign: 'left', fontSize: '13px', fontWeight: 'bold', paddingBottom: '6px', width: '55%' }}>ITEM</th>
              <th style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', paddingBottom: '6px', width: '15%' }}>QTY</th>
              <th style={{ textAlign: 'right', fontSize: '13px', fontWeight: 'bold', paddingBottom: '6px', width: '30%' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <React.Fragment key={idx}>
                {/* Product Identifier Block Line */}
                <tr className="receipt-bold-item">
                  <td style={{ textAlign: 'left', width: '55%', fontWeight: '900', verticalAlign: 'top', paddingTop: '6px' }}>{item.name}</td>
                  <td style={{ textAlign: 'center', width: '15%', fontWeight: '900', verticalAlign: 'top', paddingTop: '6px' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', width: '30%', fontWeight: '900', verticalAlign: 'top', paddingTop: '6px' }}>
                    {settings.currency}{((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                  </td>
                </tr>

                {/* Plain Text Context Instructions */}
                {item.notes && (
                  <tr className="receipt-bold-sub">
                    <td colSpan={3} style={{ paddingLeft: '12px', fontWeight: 'bold', paddingTop: '2px' }}>
                      * Note: {item.notes}
                    </td>
                  </tr>
                )}

                {/* Sub-item Modifier Layout Parameters */}
                {(item.modifiers || []).length > 0 && item.modifiers?.map((m: any, mIdx: number) => (
                  <tr key={`mod-${mIdx}`} className="receipt-bold-sub">
                    <td colSpan={2} style={{ paddingLeft: '12px', fontWeight: 'bold' }}>+ {m.label}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {m.additionalPrice > 0 ? `${settings.currency}${m.additionalPrice.toFixed(2)}` : ''}
                    </td>
                  </tr>
                ))}

                {/* Structured Multi-item Deals Nested Content Array Block */}
                {item.isDeal && item.dealComponents && (
                  <tr className="receipt-bold-sub">
                    <td colSpan={3} style={{ paddingLeft: '12px', paddingTop: '4px' }}>
                      <div style={{ borderLeft: '2px dashed #000000', paddingLeft: '8px' }}>
                        {item.dealComponents.map((comp, cIdx) => (
                          <div key={cIdx} style={{ marginBottom: '4px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>• {comp.componentName}</div>
                            {comp.modifiers && comp.modifiers.length > 0 && (
                              <div style={{ paddingLeft: '12px' }}>
                                {comp.modifiers.map((m: any, mIdx: number) => (
                                  <div key={mIdx} style={{ fontSize: '12px', fontWeight: 'bold' }}>— {m.label}</div>
                                ))}
                              </div>
                            )}
                            {comp.notes && (
                              <div style={{ paddingLeft: '12px', fontSize: '12px', fontStyle: 'italic', fontWeight: 'bold' }}>
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
                      <div className="receipt-plain-divider">--------------------------------</div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        <div className="receipt-plain-divider">================================</div>
        
        {/* TOTALS VALUE MATRIX */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr className="receipt-bold-totals">
              <td style={{ padding: '3px 0', fontWeight: 'bold', fontSize: '14px' }}>Subtotal:</td>
              <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold', fontSize: '14px' }}>{settings.currency}{(order.subtotal || 0).toFixed(2)}</td>
            </tr>
            {order.discountAmount !== undefined && order.discountAmount > 0 && (
              <tr className="receipt-bold-totals">
                <td style={{ padding: '3px 0', fontWeight: 'bold', fontSize: '14px' }}>
                  Discount {order.discountType === 'percent' ? `(${order.discountValue}%)` : ''}:
                </td>
                <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold', fontSize: '14px' }}>-{settings.currency}{(order.discountAmount || 0).toFixed(2)}</td>
              </tr>
            )}
            {order.deliveryCharge !== undefined && order.deliveryCharge > 0 && (
              <tr className="receipt-bold-totals">
                <td style={{ padding: '3px 0', fontWeight: 'bold', fontSize: '14px' }}>{settings.deliveryChargeLabel || 'Delivery Fee'}:</td>
                <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold', fontSize: '14px' }}>{settings.currency}{(order.deliveryCharge || 0).toFixed(2)}</td>
              </tr>
            )}
            {settings.showTaxLine && (
              <tr className="receipt-bold-totals">
                <td style={{ padding: '3px 0', fontWeight: 'bold', fontSize: '14px' }}>Tax ({settings.taxPercentage}%):</td>
                <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: 'bold', fontSize: '14px' }}>{settings.currency}{(order.taxAmount || 0).toFixed(2)}</td>
              </tr>
            )}
            
            {/* Grand Total Execution Matrix */}
            <tr>
              <td className="receipt-bold-grand" style={{ borderTop: '1px dashed #000000', padding: '6px 0', fontWeight: '900', fontSize: '17px' }}>GRAND TOTAL:</td>
              <td className="receipt-bold-grand" style={{ borderTop: '1px dashed #000000', padding: '6px 0', textAlign: 'right', fontWeight: '900', fontSize: '18px' }}>
                {settings.currency}{(order.total || 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-plain-divider">================================</div>

        {/* COMPONENT BILL FOOTER INFORMATION */}
        <div style={{ textAlign: 'center', width: '100%', marginTop: '6px' }}>
          {settings.receiptFooter && (
            <div className="receipt-bold-meta" style={{ whiteSpace: 'pre-line', fontWeight: 'bold', fontSize: '13px', lineHeight: '1.4' }}>
              {settings.receiptFooter}
            </div>
          )}
          <div className="receipt-bold-meta" style={{ fontWeight: 'bold', marginTop: '6px', letterSpacing: '1px', fontSize: '13px' }}>
            THANK YOU FOR VISITING!
          </div>
          
          <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '16px', borderTop: '1px solid #000000', paddingTop: '4px' }}>
            Powered by Saynz • 0347-1887181
          </div>
        </div>
      </div>
    );
  }
);