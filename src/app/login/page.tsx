'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [noHp, setNoHp] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_hp: noHp }),
      });
      let data;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error('Terjadi kesalahan pada server. Pastikan server sudah direstart.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Gagal meminta OTP');
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_hp: noHp, otp }),
      });
      let data;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error('Terjadi kesalahan pada server. Pastikan server sudah direstart.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'OTP salah atau kadaluarsa');
      }
      
      router.push(data.redirectUrl || '/overview');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl relative z-10"
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-24 h-24 bg-white rounded-2xl p-1.5 border border-white/40 shadow-xl mb-3 flex items-center justify-center">
            <img src="/logo.png" alt="CalioFish" className="w-full h-full object-contain rounded-xl" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Calio Fish</h1>
          <p className="text-blue-200 text-sm">Sistem Operasional &amp; Manajemen</p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/20 border border-red-500/50 text-red-100 p-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </motion.div>
        )}

        {step === 1 ? (
          <form onSubmit={requestOTP} className="space-y-6">
            <div>
              <label className="block text-blue-100 text-sm font-medium mb-2">Nomor WhatsApp</label>
              <input 
                type="text" 
                placeholder="081234567890" 
                required 
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:scale-100"
            >
              {loading ? 'Memproses...' : 'Kirim OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOTP} className="space-y-6">
            <div>
              <label className="block text-blue-100 text-sm font-medium mb-2">Kode OTP (WhatsApp)</label>
              <input 
                type="text" 
                placeholder="6 Digit OTP" 
                required 
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 text-center tracking-widest text-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || otp.length < 5}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:scale-100"
            >
              {loading ? 'Memverifikasi...' : 'Masuk'}
            </button>
            <div className="text-center">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="text-sm text-blue-300 hover:text-white transition-colors"
              >
                Ganti Nomor
              </button>
            </div>
          </form>
        )}
      </motion.div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}} />
    </div>
  );
}
