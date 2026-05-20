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
      <div ref={ref} className="p-8 text-black bg-white font-mono text-sm max-w-[300px] mx-auto print:block">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Kitchen Order</h1>
          <p className="text-xs font-bold uppercase mt-1">KOT #{kotNumber}</p>
          <p className="text-[10px] font-bold uppercase mt-1 opacity-70">{settings.name}</p>
          <div className="border-b-2 border-black my-2"></div>
        </div>

        <div className="space-y-1 text-sm font-bold">
          <div className="flex justify-between">
            <span>Order #:</span>
            <span>{order.orderNumber}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Date: {format(order.createdAt, 'dd/MM/yy')}</span>
            <span>Time: {format(order.createdAt, 'HH:mm')}</span>
          </div>
          
          {settings.showOrderTypeOnKOT && (
            <div className="flex justify-between border-t border-black border-dotted pt-1 mt-1">
              <span>Type:</span>
              <span className="uppercase">{order.type}</span>
            </div>
          )}

          {order.tableNumber && (
            <div className="flex justify-between">
              <span>Table:</span>
              <span className="text-lg">#{order.tableNumber}</span>
            </div>
          )}

          {settings.showCustomerNameOnKOT && order.customerName && (
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="truncate max-w-[150px]">{order.customerName}</span>
            </div>
          )}
        </div>

        <div className="border-b-2 border-black my-3"></div>

        <div className="space-y-4">
          {order.items.map((item, idx) => (
             <div key={idx} className="flex flex-col">
                <div className="flex justify-between items-start">
                   <div className="flex gap-3 items-center">
                      <span className="text-xl font-black">{item.quantity}</span>
                      <span className="text-lg font-bold uppercase">{item.name}</span>
                   </div>
                </div>
                {item.notes && (
                  <p className="text-xs italic font-semibold ml-8 mt-1 border-l-2 border-black pl-2">
                    * {item.notes}
                  </p>
                )}
                {(item.modifiers || []).length > 0 && (
                  <div className="ml-8 mt-1 border-l-2 border-black pl-2 space-y-0.5">
                    {item.modifiers?.map((m: any, mIdx: number) => (
                      <p key={mIdx} className="text-xs font-bold uppercase">+ {m.label}</p>
                    ))}
                  </div>
                )}
             </div>
          ))}
        </div>

        <div className="border-b-2 border-black my-4"></div>
        
        <div className="text-center font-bold">
          <p className="text-sm uppercase">{order.items.reduce((acc, i) => acc + i.quantity, 0)} Items Total</p>
          <p className="text-xs uppercase mt-4 tracking-widest">— KOT End —</p>
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
  deltas: DeltaSections;
}>(({ order, settings, kotNumber, totalKots, lastSentAt, deltas }, ref) => {
  const isFullCancellation = deltas.cancelled.length > 0 && 
    deltas.added.length === 0 && 
    deltas.increased.length === 0 && 
    deltas.noteChanged.length === 0 && 
    order.items.length === 0;

  return (
    <div ref={ref} className="p-8 text-black bg-white font-mono text-sm max-w-[300px] mx-auto print:block">
      <div className="text-center mb-4">
        <h1 className="text-xl font-black uppercase tracking-tighter">
          {isFullCancellation ? '*** ORDER CANCELLED ***' : '*** KITCHEN UPDATE ***'}
        </h1>
        <p className="text-[10px] font-bold uppercase mt-1 opacity-70">{settings.name}</p>
        <div className="border-b-2 border-black my-2"></div>
      </div>

      <div className="space-y-1 text-sm font-bold">
        <div className="flex justify-between">
          <span>Order #:</span>
          <span>{order.orderNumber}</span>
        </div>
        
        {order.tableNumber && (
          <div className="flex justify-between">
            <span>Table:</span>
            <span className="text-lg">#{order.tableNumber}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>KOT #:</span>
          <span>{kotNumber}</span>
        </div>

        <div className="text-[10px] opacity-70 mt-1">
          Time: {format(Date.now(), 'HH:mm:ss')}
        </div>
      </div>

      <div className="border-b-2 border-black my-3"></div>

      <div className="space-y-6">
        {/* ADDED */}
        {deltas.added.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase border-b border-black mb-2">+ ADDED:</h3>
            <div className="space-y-3">
              {deltas.added.map((item, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="flex gap-3 items-start">
                    <span className="text-lg font-black">{item.quantity}</span>
                    <span className="text-sm font-bold uppercase">{item.name}</span>
                  </div>
                  {item.notes && <p className="text-[10px] italic font-semibold ml-6">* {item.notes}</p>}
                  {(item.modifiers || []).length > 0 && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {item.modifiers?.map((m: any, mIdx: number) => (
                        <p key={mIdx} className="text-[10px] font-bold uppercase">+ {m.label}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INCREASED */}
        {deltas.increased.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase border-b border-black mb-2">+ ADD MORE:</h3>
            <div className="space-y-3">
              {deltas.increased.map((d, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="flex gap-3 items-start">
                    <span className="text-lg font-black">{d.deltaQty}</span>
                    <span className="text-sm font-bold uppercase">{d.item.name}</span>
                  </div>
                  <p className="text-[10px] opacity-60 ml-6">(Total now: {d.item.quantity})</p>
                  {d.item.notes && <p className="text-[10px] italic font-semibold ml-6">* {d.item.notes}</p>}
                  {(d.item.modifiers || []).length > 0 && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {d.item.modifiers?.map((m: any, mIdx: number) => (
                        <p key={mIdx} className="text-[10px] font-bold uppercase">+ {m.label}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTE CHANGED */}
        {deltas.noteChanged.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase border-b border-black mb-2">~ NOTE UPDATE:</h3>
            <div className="space-y-3">
              {deltas.noteChanged.map((d, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="flex gap-2 items-start mb-1">
                    <span className="text-xs font-black">{d.item.quantity} x</span>
                    <span className="text-xs font-bold uppercase">{d.item.name}</span>
                  </div>
                  <div className="ml-4 space-y-1">
                    <p className="text-[9px] line-through opacity-50 italic">Old: {d.oldNote || '(none)'}</p>
                    <p className="text-[9px] font-black italic">New: {d.newNote || '(none)'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CANCELLED */}
        {deltas.cancelled.length > 0 && (
          <div className="bg-black/5 p-2 rounded">
            <h3 className="text-xs font-black uppercase border-b border-black mb-2 text-center">✕ CANCELLED:</h3>
            <div className="space-y-2">
              {deltas.cancelled.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center justify-between">
                  <div className="flex gap-2 items-center">
                    <span className="text-sm font-black line-through">{item.quantity}</span>
                    <span className="text-xs font-bold uppercase line-through opacity-60">{item.name}</span>
                  </div>
                  <span className="text-[8px] font-bold border border-black px-1">STOP</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-b-2 border-black my-4"></div>
      
      <div className="text-center font-bold text-[10px]">
        <p className="uppercase">Update {kotNumber} of {totalKots}</p>
        {lastSentAt && <p className="opacity-70 mt-1 uppercase text-[8px]">Previous KOT sent at: {format(lastSentAt, 'HH:mm')}</p>}
        <p className="text-[8px] uppercase mt-4 tracking-widest">— Update End —</p>
      </div>
    </div>
  );
});

export const CustomerReceipt = React.forwardRef<HTMLDivElement, { order: Order; settings: RestaurantSettings }>(
  ({ order, settings }, ref) => {
    return (
      <div ref={ref} className="p-8 text-black bg-white font-mono text-sm max-w-[300px] mx-auto print:block">
        <div className="text-center mb-4">
          <h2 className="text-xl font-black uppercase tracking-tight">{settings.name}</h2>
          <p className="text-[10px] leading-tight mt-1">{settings.address}</p>
          {settings.phone && <p className="text-[10px] leading-tight">{settings.phone}</p>}
          <div className="border-b border-black border-dashed my-2"></div>
          <p className="text-[10px] uppercase font-bold tracking-tight">{settings.receiptHeader}</p>
        </div>
        
        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span>Order #:</span>
            <span className="font-bold">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{format(order.createdAt, 'dd/MM/yyyy')}</span>
          </div>
          <div className="flex justify-between">
            <span>Time:</span>
            <span>{format(order.createdAt, 'HH:mm:ss')}</span>
          </div>
          <div className="flex justify-between border-t border-black border-dotted pt-1 mt-1">
            <span>Type:</span>
            <span className="font-bold uppercase">{order.type}</span>
          </div>
          {order.tableNumber && (
            <div className="flex justify-between">
              <span>Table:</span>
              <span className="font-bold">{order.tableNumber}</span>
            </div>
          )}
          {order.customerName && (
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="truncate max-w-[120px]">{order.customerName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>TERMINAL-01</span>
          </div>
        </div>

        <div className="border-b border-black border-dashed my-2"></div>
        
        <div className="mb-4">
          <table className="w-full text-left text-[10px]">
            <thead>
              <tr className="border-b border-black border-dotted">
                <th className="py-1">Item</th>
                <th className="py-1 text-center">Qty</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <React.Fragment key={idx}>
                  <tr>
                    <td className="py-1 line-clamp-1">{item.name}</td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">{settings.currency}{((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                  </tr>
                  {item.notes && (
                    <tr>
                      <td colSpan={3} className="text-[8px] italic pb-1 text-slate-700">
                        Instructions: {item.notes}
                      </td>
                    </tr>
                  )}
                  {(item.modifiers || []).length > 0 && item.modifiers?.map((m: any, mIdx: number) => (
                    <tr key={`mod-${mIdx}`}>
                      <td className="text-[8px] pl-2 opacity-70 tracking-tight">+ {m.label}</td>
                      <td></td>
                      <td className="text-[8px] text-right opacity-70">
                        {m.additionalPrice > 0 ? `${settings.currency}${m.additionalPrice.toFixed(2)}` : ''}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-b border-black border-dashed mb-2"></div>
        
        <div className="text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{settings.currency}{(order.subtotal || 0).toFixed(2)}</span>
          </div>
          {order.deliveryCharge !== undefined && order.deliveryCharge > 0 && (
            <div className="flex justify-between">
              <span>{settings.deliveryChargeLabel}:</span>
              <span>{settings.currency}{(order.deliveryCharge || 0).toFixed(2)}</span>
            </div>
          )}
          {order.deliveryChargeWaived && (
            <div className="flex justify-between">
              <span>{settings.deliveryChargeLabel}:</span>
              <span>{settings.currency}0.00 (Waived)</span>
            </div>
          )}
          {settings.showTaxLine && (
            <div className="flex justify-between">
              <span>Tax ({settings.taxPercentage}%):</span>
              <span>{settings.currency}{(order.taxAmount || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-1 mt-1 border-t border-black border-dotted">
            <span>GRAND TOTAL:</span>
            <span>{settings.currency}{(order.total || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="border-b border-black border-dashed mt-4 mb-2"></div>

        <div className="text-center space-y-4">
          <p className="text-[10px] uppercase whitespace-pre-line leading-tight">
            {settings.receiptFooter}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest">Thank you for visiting!</p>
          <div className="flex justify-center mt-4">
             <div className="w-16 h-1 border-b border-black"></div>
          </div>
        </div>
      </div>
    );
  }
);
