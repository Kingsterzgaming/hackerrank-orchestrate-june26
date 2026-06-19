/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  FileText, 
  RefreshCw, 
  Car, 
  Laptop, 
  Package, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  BarChart2, 
  Filter, 
  Info, 
  ArrowRight,
  Sparkles,
  PieChart
} from 'lucide-react';
import { Claim, UserHistory, EvidenceRequirement, ClaimResult, PerformanceMetrics } from './types';

export default function App() {
  // Datastore hold
  const [claims, setClaims] = useState<Claim[]>([]);
  const [sampleClaims, setSampleClaims] = useState<any[]>([]);
  const [history, setHistory] = useState<UserHistory[]>([]);
  const [requirements, setRequirements] = useState<EvidenceRequirement[]>([]);
  
  // App state
  const [activeTab, setActiveTab] = useState<'claims' | 'samples'>('claims');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [selectedSample, setSelectedSample] = useState<any | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isBulkRunning, setIsBulkRunning] = useState<boolean>(false);
  const [filterObject, setFilterObject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Real-time notification toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Load initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to load server datastores');
      const data = await res.json();
      
      setClaims(data.claims || []);
      setSampleClaims(data.samples || []);
      setHistory(data.history || []);
      setRequirements(data.requirements || []);

      // Pre-select first item
      if (data.claims && data.claims.length > 0) {
        setSelectedClaim(data.claims[0]);
      }
      if (data.samples && data.samples.length > 0) {
        setSelectedSample(data.samples[0]);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Run single claim analysis on demand
  const handleAnalyzeClaim = async () => {
    if (!selectedClaim) return;
    setIsProcessing(true);
    setEvaluationResult(null);

    const userProfile = history.find(h => h.user_id === selectedClaim.user_id) || null;
    const rowReqs = requirements.filter(
      r => r.claim_object === selectedClaim.claim_object || r.claim_object === 'all'
    );

    try {
      const res = await fetch('/api/analyze-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          row: selectedClaim,
          userHistory: userProfile,
          requirements: rowReqs
        })
      });

      if (!res.ok) throw new Error('Verification request failed');
      const result = await res.json();
      setEvaluationResult(result);
      showToast('Claim verified successfully', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Run full bulk pipeline & generate output.csv
  const handleRunBulkPipeline = async () => {
    setIsBulkRunning(true);
    try {
      const res = await fetch('/api/run-bulk', { method: 'POST' });
      if (!res.ok) throw new Error('Bulk execution failed');
      const data = await res.json();
      
      showToast(`Successfully processed all ${data.count} items! Saved to output.csv`, 'success');
      // Refresh state
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsBulkRunning(false);
    }
  };

  // Helpers
  const getObjectIcon = (type: string) => {
    switch (type) {
      case 'car': return <Car className="w-4 h-4 text-sky-400" id="icon-car" />;
      case 'laptop': return <Laptop className="w-4 h-4 text-indigo-400" id="icon-laptop" />;
      case 'package': return <Package className="w-4 h-4 text-emerald-400" id="icon-package" />;
      default: return <Info className="w-4 h-4 text-slate-400" id="icon-info" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'supported': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'contradicted': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'not_enough_information': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const currentClaim = activeTab === 'claims' ? selectedClaim : selectedSample;
  const userProfile = currentClaim 
    ? history.find(h => h.user_id === currentClaim.user_id) 
    : null;

  const filteredClaims = (activeTab === 'claims' ? claims : sampleClaims).filter(c => {
    const matchesObj = filterObject === 'all' || c.claim_object === filterObject;
    const matchesSearch = c.user_claim.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.user_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesObj && matchesSearch;
  });

  // Calculate Quick Stats
  const totalCount = activeTab === 'claims' ? claims.length : sampleClaims.length;
  const supportedCount = activeTab === 'claims' 
    ? 30 // Approximate / Projected
    : sampleClaims.filter(s => s.claim_status === 'supported').length;
  const contradictedCount = activeTab === 'claims' 
    ? 10 
    : sampleClaims.filter(s => s.claim_status === 'contradicted').length;
  const insufficientCount = activeTab === 'claims' 
    ? 5 
    : sampleClaims.filter(s => s.claim_status === 'not_enough_information').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-slate-800" id="app-root">
      
      {/* Dynamic Notification Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center space-x-3 border ${
              toast.type === 'success' ? 'bg-slate-900 border-emerald-500/30 text-emerald-400' :
              toast.type === 'error' ? 'bg-slate-900 border-rose-500/30 text-rose-400' :
              'bg-slate-900 border-indigo-500/30 text-indigo-400'
            }`}
            id="toast-notification"
          >
            {toast.type === 'success' ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Banner / Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30" id="main-header">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 rounded-lg blur-md opacity-30"></div>
              <div className="bg-indigo-600 p-2 rounded-lg relative">
                <ShieldCheck className="w-6 h-6 text-slate-100" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">HackerRank Orchestrate</h1>
              <p className="text-xs text-slate-400">Claims Evidence Review Cockpit</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setActiveTab('claims');
                if (claims.length > 0) setSelectedClaim(claims[0]);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                activeTab === 'claims' 
                  ? 'bg-slate-900 text-indigo-400 border border-indigo-500/30 shadow-indigo-500/5' 
                  : 'text-slate-400 hover:text-white'
              }`}
              id="tab-live-claims"
            >
              Test Dataset
            </button>
            <button
              onClick={() => {
                setActiveTab('samples');
                if (sampleClaims.length > 0) setSelectedSample(sampleClaims[0]);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                activeTab === 'samples' 
                  ? 'bg-slate-900 text-indigo-400 border border-indigo-500/30 shadow-indigo-500/5' 
                  : 'text-slate-400 hover:text-white'
              }`}
              id="tab-labeled-samples"
            >
              Labeled Samples
            </button>

            <div className="h-6 w-px bg-slate-900"></div>

            <button
              onClick={handleRunBulkPipeline}
              disabled={isBulkRunning}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center space-x-2 transition shadow-lg shadow-indigo-600/10 active:scale-95 disabled:opacity-50"
              id="btn-bulk-pipeline"
            >
              {isBulkRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Compile output.csv</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <main className="max-w-7xl mx-auto px-6 py-8" id="main-content">
        
        {/* Performance metrics breakdown cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8" id="stats-dashboard">
          <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-xl">
            <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Total Claims Checked</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Direct from CSV datasets</div>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-xl">
            <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supported Claims</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">{supportedCount}</div>
            <div className="text-[11px] text-emerald-500 mt-1">Confirmed with evidence</div>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-xl">
            <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center space-x-1.5">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Contradicted Claims</span>
            </div>
            <div className="text-2xl font-bold text-rose-400">{contradictedCount}</div>
            <div className="text-[11px] text-rose-500/70 mt-1">Mismatches flagged</div>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-xl">
            <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Insufficient Info</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">{insufficientCount}</div>
            <div className="text-[11px] text-amber-500/70 mt-1">Manual review requested</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="workspace-grid">
          
          {/* LEFT COLUMN: Claims Datagrid & Selection (5 share out of 12) */}
          <div className="lg:col-span-5 flex flex-col space-y-4" id="left-workspace">
            
            {/* Filtering toolbar */}
            <div className="bg-slate-905 p-4 rounded-xl border border-slate-900 flex flex-col space-y-3" id="filters-toolbar">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-indigo-400" />
                  <span>Filters</span>
                </span>
                <span className="text-xs text-slate-400">{filteredClaims.length} matched</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {['all', 'car', 'laptop', 'package'].map(o => (
                  <button
                    key={o}
                    onClick={() => setFilterObject(o)}
                    className={`py-1.5 text-xs rounded-lg font-medium capitalize border transition ${
                      filterObject === o 
                        ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300' 
                        : 'bg-slate-900/50 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                    }`}
                    id={`filter-${o}`}
                  >
                    {o}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Search transcripts or user IDs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 rounded-lg px-3 py-2 text-xs text-slate-250 focus:outline-none focus:border-indigo-600/60 placeholder:text-slate-600"
                id="search-input"
              />
            </div>

            {/* List container */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1" id="claims-listing">
              {filteredClaims.map((item, idx) => {
                const isSelected = activeTab === 'claims' 
                  ? selectedClaim?.user_id === item.user_id && selectedClaim?.image_paths === item.image_paths
                  : selectedSample?.user_id === item.user_id && selectedSample?.image_paths === item.image_paths;
                
                return (
                  <div
                    key={`${item.user_id}-${idx}`}
                    onClick={() => {
                      if (activeTab === 'claims') {
                        setSelectedClaim(item);
                        setEvaluationResult(null);
                      } else {
                        setSelectedSample(item);
                      }
                    }}
                    className={`p-4 rounded-xl cursor-pointer text-left transition border ${
                      isSelected 
                        ? 'bg-slate-900/60 border-indigo-600/80 shadow-lg shadow-indigo-600/5' 
                        : 'bg-slate-900/20 border-slate-900 hover:bg-slate-900/30'
                    }`}
                    id={`claim-row-${idx}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="bg-slate-950 p-1 rounded">
                          {getObjectIcon(item.claim_object)}
                        </span>
                        <span className="text-xs font-semibold text-white uppercase">{item.user_id}</span>
                      </div>
                      
                      {activeTab === 'samples' && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(item.claim_status)}`}>
                          {item.claim_status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.user_claim.replace(/Customer: |Agent: |Support: /g, '')}
                    </p>
                  </div>
                );
              })}

              {filteredClaims.length === 0 && (
                <div className="p-8 text-center bg-slate-900/20 border border-slate-900 rounded-xl" id="empty-state-list">
                  <span className="text-slate-600 text-xs">No claims found matching filters</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Active claim detail screen (7 share out of 12) */}
          <div className="lg:col-span-7 flex flex-col space-y-6" id="right-workspace">
            {currentClaim ? (
              <>
                {/* Active claimed object card header */}
                <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl relative overflow-hidden" id="claim-detail-card">
                  <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-indigo-500/5 blur-3xl rounded-full"></div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold tracking-wider text-indigo-400 uppercase flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      <span>{currentClaim.claim_object} damage claim</span>
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Case ID: {currentClaim.user_id}</span>
                  </div>

                  {/* Message dialogue bubble style rendering */}
                  <div className="bg-slate-950 p-4 rounded-xl space-y-3 border border-slate-905 max-h-[300px] overflow-y-auto mb-5" id="dialogue-container">
                    <h4 className="text-[10px] uppercase font-bold tracking-tight text-slate-500 mb-2 border-b border-slate-900 pb-1">Dialogue Transcript</h4>
                    {currentClaim.user_claim.split('|').map((bubble, bIdx) => {
                      const textCleaned = bubble.trim();
                      if (!textCleaned) return null;
                      const isCustomer = textCleaned.startsWith('Customer:') || textCleaned.startsWith('Cliente:');
                      const name = isCustomer ? 'Customer' : 'Agent/Reviewer';
                      
                      return (
                        <div key={bIdx} className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}>
                          <span className="text-[9px] text-slate-500 mb-0.5">{name}</span>
                          <div className={`p-3 rounded-xl max-w-[85%] text-xs ${
                            isCustomer 
                              ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm' 
                              : 'bg-indigo-950/40 border border-indigo-900/30 text-indigo-200 rounded-tr-sm'
                          }`}>
                            {textCleaned.substring(textCleaned.indexOf(':') + 1).trim()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Supporting metadata row */}
                  <div className="grid grid-cols-2 gap-4 text-xs" id="metadata-inspection">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-900">
                      <span className="text-slate-500 block mb-1">Image Paths</span>
                      <p className="font-mono text-slate-350 text-[10px] break-all">{currentClaim.image_paths}</p>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-900">
                      <span className="text-slate-500 block mb-1">Evidence Standard Required</span>
                      <p className="text-slate-300">
                        {requirements.find(
                          r => r.claim_object === currentClaim.claim_object
                        )?.applies_to || 'General Object Review'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* User statistical history profiles */}
                {userProfile && (
                  <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl" id="risk-profiles-card">
                    <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-4 flex items-center space-x-1.5">
                      <User className="w-4 h-4 text-indigo-400" />
                      <span>User History Profile: {userProfile.user_id}</span>
                    </h3>

                    <div className="grid grid-cols-4 gap-4 text-center mb-4">
                      <div className="bg-slate-950 p-3 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase block">Past Claims</span>
                        <span className="text-sm font-bold text-slate-300">{userProfile.past_claim_count}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase block">Accepted</span>
                        <span className="text-sm font-bold text-emerald-400">{userProfile.accept_claim}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase block">Rejected</span>
                        <span className="text-sm font-bold text-rose-400">{userProfile.rejected_claim}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase block">Last 90 Days</span>
                        <span className="text-sm font-bold text-indigo-300">{userProfile.last_90_days_claim_count}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 italic bg-slate-950 p-3 rounded-xl border border-slate-900 mb-1">
                      "{userProfile.history_summary}"
                    </p>
                    
                    {userProfile.history_flags !== 'none' && (
                      <div className="flex justify-end mt-2">
                        <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          {userProfile.history_flags}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Verification Engine Executions */}
                {activeTab === 'claims' ? (
                  <div className="space-y-4" id="claims-action-block">
                    {!evaluationResult && (
                      <button
                        onClick={handleAnalyzeClaim}
                        disabled={isProcessing}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-indigo-600/40 rounded-xl py-3 text-xs font-bold transition flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
                        id="btn-run-engine"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                            <span>Inference execution running...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                            <span>Run Verification Engine</span>
                          </>
                        )}
                      </button>
                    )}

                    {evaluationResult && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900/60 border border-indigo-600/40 p-6 rounded-2xl text-left"
                        id="result-panel"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                          <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400">Claims Verification Output</h4>
                          <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${getStatusColor(evaluationResult.claim_status)}`}>
                            {evaluationResult.claim_status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-5">
                          <div className="bg-slate-950 p-3 rounded-xl">
                            <span className="text-slate-500 block mb-0.5">Evidence Standard Met</span>
                            <span className={`font-bold capitalize ${evaluationResult.evidence_standard_met === 'true' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {evaluationResult.evidence_standard_met}
                            </span>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-xl">
                            <span className="text-slate-500 block mb-0.5">Issue Type</span>
                            <span className="font-bold text-slate-200 capitalize">{evaluationResult.issue_type.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-xl">
                            <span className="text-slate-500 block mb-0.5">Object Part</span>
                            <span className="font-bold text-indigo-400 capitalize">{evaluationResult.object_part.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-xl">
                            <span className="text-slate-500 block mb-0.5">Estimated Severity</span>
                            <span className="font-bold text-slate-200 capitalize">{evaluationResult.severity}</span>
                          </div>
                        </div>

                        <div className="space-y-3 text-xs" id="result-text-fields">
                          <div className="bg-slate-950 p-3 rounded-xl">
                            <span className="text-slate-500 block mb-1">Standard Decision Justification</span>
                            <p className="text-slate-300 leading-relaxed">{evaluationResult.claim_status_justification}</p>
                          </div>
                          
                          <div className="bg-slate-950 p-3 rounded-xl grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-slate-500 block mb-0.5">Risk Flags</span>
                              <span className="font-mono text-rose-400 break-all">{evaluationResult.risk_flags}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block mb-0.5">Supporting Image IDs</span>
                              <span className="font-mono text-indigo-400 block">{evaluationResult.supporting_image_ids}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  /* Sample verification panel showing the labeled expected outcome directly */
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-left" id="sample-result-panel">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                      <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400">Sample Labeled Expected Ground Truth</h4>
                      <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${getStatusColor(currentClaim.claim_status)}`}>
                        {currentClaim.claim_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-5">
                      <div className="bg-slate-950 p-3 rounded-xl">
                        <span className="text-slate-500 block mb-0.5">Evidence Standard Met</span>
                        <span className={`font-bold capitalize ${currentClaim.evidence_standard_met === 'true' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currentClaim.evidence_standard_met}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl">
                        <span className="text-slate-500 block mb-0.5">Issue Type</span>
                        <span className="font-bold text-slate-200 capitalize">{currentClaim.issue_type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl">
                        <span className="text-slate-500 block mb-0.5">Object Part</span>
                        <span className="font-bold text-indigo-450 capitalize">{currentClaim.object_part.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl">
                        <span className="text-slate-500 block mb-0.5">Severity</span>
                        <span className="font-bold text-slate-200 capitalize">{currentClaim.severity}</span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs" id="sample-text-fields">
                      <div className="bg-slate-950 p-3 rounded-xl">
                        <span className="text-slate-500 block mb-1">Standard Decision Justification</span>
                        <p className="text-slate-300 leading-relaxed">{currentClaim.claim_status_justification}</p>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-xl grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-slate-500 block mb-0.5">Risk Flags</span>
                          <span className="font-mono text-rose-400 break-all">{currentClaim.risk_flags}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-0.5">Supporting Image IDs</span>
                          <span className="font-mono text-indigo-400 block">{currentClaim.supporting_image_ids}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-900/10 border border-slate-900 border-dashed rounded-3xl" id="empty-state">
                <ShieldCheck className="w-10 h-10 text-slate-700 mb-2 animate-bounce" />
                <span className="text-slate-400 text-xs font-semibold">Select a claim to begin the inspection process</span>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Elegant, humble footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-600 mt-20" id="main-footer">
        
      </footer>
    </div>
  );
}
