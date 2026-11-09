import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ShieldCheck, Truck, CreditCard, Headphones, ShoppingBag } from 'lucide-react';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F8F5] text-slate-950">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Footer Comercial Flagship */}
      <footer className="mt-16 border-t border-stone-200/90 bg-white text-slate-600">
        {/* Franja de Respaldo y Garantías */}
        <div className="border-b border-stone-100 bg-stone-50/70">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Truck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-950">Envío Express a toda Guatemala</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cobertura asegurada en Ciudad de Guatemala (24h) y los 22 departamentos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-950">Garantía Oficial de 12 Meses</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Productos 100% originales con respaldo directo y devoluciones en línea.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                <CreditCard className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-950">Precios Transparentes en GTQ</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Todas nuestras tarifas en Quetzales incluyen el 12% de IVA de ley sin recargos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Headphones className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-950">Reserva Garantizada en Checkout</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Apartamos tu stock durante 15 minutos y congelamos tu precio al comprar.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Columnas editoriales del Footer */}
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <span className="font-display text-base font-extrabold tracking-tight text-slate-950">
                DON ARTURO · FLAGSHIP STORE
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              La tienda en línea de referencia en Guatemala para tecnología de alto desempeño, audio
              profesional, equipamiento para el hogar y estilo de vida contemporáneo.
            </p>
            <p className="text-[11px] font-medium text-slate-400">
              Centro Corporativo Zona 10, Ciudad de Guatemala · Atención PBX: (502) 2210-9000
            </p>
          </div>

          <div className="md:col-span-3 space-y-2.5 text-xs">
            <h4 className="font-display font-bold text-slate-950 uppercase tracking-wider text-[11px]">
              Experiencia de Compra
            </h4>
            <ul className="space-y-2 text-slate-600">
              <li>
                <Link to="/" className="hover:text-slate-950 transition">
                  Explorar Catálogo Completo
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-slate-950 transition">
                  Mi Bolsa de Compras
                </Link>
              </li>
              <li>
                <Link to="/my-orders" className="hover:text-slate-950 transition">
                  Rastreo de Pedidos y Devoluciones
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-slate-950 transition">
                  Libreta de Direcciones de Entrega
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5 text-xs">
            <h4 className="font-display font-bold text-slate-950 uppercase tracking-wider text-[11px]">
              Pagos Protegidos y Beneficios
            </h4>
            <p className="text-slate-500 leading-relaxed">
              Aceptamos Tarjetas de Crédito y Débito Visa / Mastercard, Transferencias Bancarias ACH
              y Pago Contra Entrega en todo el país.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                VISA / MASTERCARD
              </span>
              <span className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                TRANSFERENCIA ACH
              </span>
              <span className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                CONTRA ENTREGA GT
              </span>
            </div>
          </div>
        </div>

        {/* Sub-footer legal */}
        <div className="border-t border-stone-100 py-4 text-[11px] text-slate-400">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} Don Arturo Guatemala, S.A. Todos los derechos reservados.</p>
            <p>Moneda oficial: Quetzales (GTQ) · Precios incluyen 12% IVA</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
