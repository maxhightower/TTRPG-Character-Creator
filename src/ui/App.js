import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Builder from './Builder';
import { NodeOptimizer } from './NodeOptimizer';
export function App() {
    const [tab, setTab] = useState('builder');
    return (_jsxs("div", { style: { fontFamily: 'system-ui, Arial, sans-serif', color: '#0f172a' }, children: [_jsxs("header", { style: { padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("h1", { style: { margin: 0, fontSize: 18 }, children: "TTRPG Character Creator (5e)" }), _jsxs("nav", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { onClick: () => setTab('builder'), style: btn(tab === 'builder'), children: "Character Builder" }), _jsx("button", { onClick: () => setTab('optimizer'), style: btn(tab === 'optimizer'), children: "DPR Graph Optimizer" })] })] }), _jsx("main", { style: { padding: 16 }, children: tab === 'builder' ? _jsx(Builder, {}) : _jsx(NodeOptimizer, {}) })] }));
}
function btn(active) {
    return {
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid #cbd5e1',
        background: active ? '#0ea5e9' : 'white',
        color: active ? 'white' : '#0f172a',
        cursor: 'pointer'
    };
}
