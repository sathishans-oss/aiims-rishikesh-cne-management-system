import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Copy, RefreshCw, ShieldCheck } from 'lucide-react';
import { Cne, User } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';

export interface QrAttendanceModalProps {
  isOpen: boolean; onClose: () => void; cne: Cne | null; currentUser: User | null;
  onAttendanceMarked: () => void; onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const QrAttendanceModal: React.FC<QrAttendanceModalProps> = ({isOpen,onClose,cne,currentUser,onAttendanceMarked,onShowToast}) => {
  const [qrToken,setQrToken]=useState(''); const [loadingToken,setLoadingToken]=useState(false); const [marking,setMarking]=useState(false); const [markedSuccess,setMarkedSuccess]=useState(false);
  const canManage=Boolean(currentUser?.isAdmin||currentUser?.isAreaIncharge);
  useEffect(()=>{if(isOpen&&cne){setMarkedSuccess(false);void fetchToken();}},[isOpen,cne?.id]);
  const fetchToken=async()=>{if(!cne)return;setLoadingToken(true);try{const res=await api.getQrToken(cne.id);setQrToken(res.qr_token);}catch(err:any){onShowToast('error',err.message||'Failed to generate QR token');}finally{setLoadingToken(false);}};
  const attendanceUrl=qrToken && typeof window!=='undefined' ? `${window.location.origin}/?attendance_token=${encodeURIComponent(qrToken)}` : '';
  const handleSelfCheckin=async()=>{if(!qrToken)return;setMarking(true);try{await api.scanQrAttendance(qrToken);setMarkedSuccess(true);onShowToast('success','Attendance marked successfully!');onAttendanceMarked();}catch(err:any){onShowToast('error',err.message||'Check-in failed');}finally{setMarking(false);}};
  const copy=()=>{if(attendanceUrl){void navigator.clipboard.writeText(attendanceUrl);onShowToast('info','Attendance link copied.');}};
  if(!cne)return null;
  return <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" title="Session Attendance & QR Verification" subtitle={`${cne.cne_id}: ${cne.title}`}>
    <div className="text-center space-y-5 py-2">
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 inline-block mx-auto shadow-xs">
        <div className="w-52 h-52 bg-white rounded-xl border border-slate-300 p-3 flex items-center justify-center">
          {loadingToken ? <RefreshCw className="w-8 h-8 animate-spin text-emerald-700"/> : qrToken ? <QRCodeSVG value={attendanceUrl} size={180} level="M" includeMargin aria-label="CNE attendance QR code"/> : <span className="text-xs text-slate-500">QR unavailable</span>}
        </div>
        <div className="mt-3 text-xs font-mono font-bold text-slate-700">Session Date: {cne.cne_date}</div>
      </div>
      {markedSuccess ? <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5"/><span className="font-semibold">Your attendance has been verified and recorded.</span></div> :
      <div className="space-y-3 max-w-sm mx-auto">
        <p className="text-xs text-slate-600">Scan this signed QR with a phone. After sign-in, the portal verifies the officer, enrollment, CNE state and duplicate attendance server-side.</p>
        {!canManage && <Button variant="primary" size="md" onClick={handleSelfCheckin} loading={marking} icon={<ShieldCheck className="w-4 h-4"/>} className="font-semibold w-full justify-center">Mark My Attendance Now</Button>}
        <div className="pt-2 flex items-center justify-center gap-3"><button type="button" onClick={copy} className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1"><Copy className="w-3.5 h-3.5"/> Copy attendance link</button><button type="button" onClick={fetchToken} className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5"/> Refresh QR</button></div>
      </div>}
    </div>
  </Modal>;
};
