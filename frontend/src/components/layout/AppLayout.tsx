import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-5 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <p>
            <strong className="text-slate-800">ShopCart GT</strong> — Tech Challenge 360 (SQL Server
            2022 + Node.js 24 TS + React 18 TS)
          </p>
          <p>Moneda: Quetzales (GTQ) · Precios incluyen 12% IVA · Acceso 100% por Stored Procedures</p>
        </div>
      </footer>
    </div>
  );
};
