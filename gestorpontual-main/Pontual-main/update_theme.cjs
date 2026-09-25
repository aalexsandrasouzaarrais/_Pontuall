const fs = require('fs');
let content = fs.readFileSync('src/components/EmployeeCalendarView.tsx', 'utf8');

const replacements = [
  ['className="space-y-3"', 'className="space-y-3 bg-black text-white rounded-xl min-h-[800px] p-2"'],
  ['bg-white p-3 rounded-xl border border-slate-200', 'bg-white/5 p-3 rounded-xl border border-white/10'],
  ['text-slate-900', 'text-white'],
  ['text-slate-500', 'text-white/60'],
  ['text-slate-600', 'text-white/60'],
  ['text-slate-700', 'text-white/80'],
  ['text-slate-400', 'text-white/40'],
  ['text-[#166534]', 'text-[#F89847]'],
  ['bg-purple-50 hover:bg-purple-100 text-[#6D28D9] border border-purple-200', 'bg-[#96183C]/20 hover:bg-[#96183C]/40 text-[#FAF0AC] border border-[#96183C]'],
  ['bg-[#BBF7D0]/40 hover:bg-[#BBF7D0]/70 text-[#166534] border border-emerald-300', 'bg-[#F89847]/20 hover:bg-[#F89847]/40 text-[#FAF0AC] border border-[#F89847]'],
  ['bg-white rounded-xl border border-slate-200', 'bg-[#121212] rounded-xl border border-white/10'],
  ['bg-emerald-50 px-2 py-0.5 rounded font-bold font-mono border border-emerald-200', 'bg-[#96183C]/20 px-2 py-0.5 rounded font-bold font-mono border border-[#96183C]/50 text-[#FAF0AC]'],
  ['bg-slate-100', 'bg-white/5'],
  ['border-slate-200', 'border-white/10'],
  ['bg-white text-[#166534] shadow-xs', 'bg-[#96183C] text-[#FAF0AC] shadow-xs'],
  ['hover:bg-white ', 'hover:bg-white/10 '],
  ['hover:text-emerald-700', 'hover:text-[#F89847]'],
  ['border-slate-100', 'border-white/10'],
  ['text-emerald-700', 'text-[#F89847]'],
  ['bg-slate-50/50 rounded-lg border border-dashed border-slate-100', 'bg-white/5 rounded-lg border border-dashed border-white/10'],
  ['bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-500/20', 'bg-[#96183C]/40 border-[#F89847] ring-1 ring-[#F89847]/30'],
  ['bg-white border-slate-200 hover:border-emerald-300', 'bg-white/10 border-white/20 hover:border-[#F89847]'],
  ['bg-slate-50/30 border-slate-200/60', 'bg-white/5 border-white/10'],
  ['bg-[#BBF7D0]/40 border-emerald-300 text-[#166534]', 'bg-[#96183C]/30 border-[#96183C] text-white'],
  ['bg-purple-50 border-purple-200 text-purple-950', 'bg-black/40 border-white/10 text-white/80'],
  ['bg-[#166534] text-white border-emerald-700', 'bg-[#96183C] text-[#FAF0AC] border-[#F89847]'],
  ['bg-slate-50 text-slate-700 border-slate-200', 'bg-white/5 text-white/80 border-white/10'],
  ['bg-slate-50/40 rounded-lg border border-slate-200/70', 'bg-black/50 rounded-lg border border-white/10'],
  ['bg-slate-50/50 rounded-lg border border-slate-200', 'bg-black/40 rounded-lg border border-white/10'],
  ['bg-emerald-50 border border-emerald-200', 'bg-[#96183C]/20 border border-[#96183C]/50'],
  ['bg-[#BBF7D0]/30 border-emerald-300 text-[#166534]', 'bg-[#96183C]/30 border-[#96183C] text-white'],
  ['bg-purple-50/70 border-purple-200 text-purple-950', 'bg-black/50 border-white/10 text-white/80'],
  ['bg-white border border-slate-200', 'bg-white/5 border border-white/10'],
  ['bg-emerald-100 text-[#166534]', 'bg-[#F89847]/20 text-[#F89847]'],
  ['border-emerald-300', 'border-[#F89847]/50']
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

fs.writeFileSync('src/components/EmployeeCalendarView.tsx', content);
