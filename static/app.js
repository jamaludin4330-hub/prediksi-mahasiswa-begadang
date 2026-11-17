const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f6=x=>Number(x).toFixed(6).replace('.',',');
let S;
function burst(x=innerWidth/2,y=innerHeight/2,n=30){const c=['#ff6fa8','#d9c6ff','#ffc9a8','#b7ecd6','#ffe48a'];
 for(let i=0;i<n;i++){const s=document.createElement('span');s.className='pf';
 s.style.cssText=`left:${x}px;top:${y}px;background:${c[i%5]};border-radius:${i%2?'50%':'3px'};--x:${Math.random()*500-250}px;--y:${Math.random()*500-250}px`;
 document.body.appendChild(s);setTimeout(()=>s.remove(),1200)}}
function reset(){S=JSON.parse(JSON.stringify({features:DEF.features,rows:DEF.rows,target:DEF.target}));drawTable();drawCfg()}
function sync(){$$('#data input').forEach(i=>{const[k,r,c]=i.dataset.k.split(',');
 if(k=='h')S.features[c]=i.value;else if(k=='t')S.target[c]=i.value;else S.rows[r][c]=i.value})}
function drawTable(){let h='<tr><th>No</th>'+S.features.map((f,c)=>`<th><input data-k="h,0,${c}" value="${esc(f)}"></th>`).join('')+'<th>Kelas (target)</th><th></th></tr>';
 S.rows.forEach((r,i)=>{h+=`<tr><td>P${i+1}</td>`+r.map((v,c)=>`<td><input data-k="r,${i},${c}" value="${esc(v)}"></td>`).join('')+`<td><button data-del="${i}" class="ghost">x</button></td></tr>`});
 h+='<tr class="tg"><td>Target</td>'+S.target.map((v,c)=>`<td><input data-k="t,0,${c}" value="${esc(v)}"></td>`).join('')+'<td>?</td><td></td></tr>';
 $('#data').innerHTML=h;
 $$('[data-del]').forEach(b=>b.onclick=()=>{sync();S.rows.splice(+b.dataset.del,1);drawTable();drawCfg()});
 $$('#data input').forEach(i=>i.onchange=()=>{sync();drawCfg()})}
function drawCfg(){const old=$$('.tcfg').map(e=>({mode:e.querySelector('select').value,ids:e.querySelectorAll('textarea')[0].value,cands:e.querySelectorAll('textarea')[1].value}));
 $('#cfg').innerHTML=[0,1,2].map(t=>{const dm=DEF.manual[t]||{ids:[],cands:''};const o=old[t]||{mode:'auto',ids:dm.ids.join(', '),cands:dm.cands};
 return `<div class="tcfg"><h3>Pohon ${t+1}<select><option value="auto" ${o.mode=='auto'?'selected':''}>Otomatis</option><option value="manual" ${o.mode=='manual'?'selected':''}>Manual</option></select></h3>
 <p class="muted hint" style="margin:0;display:${o.mode=='manual'?'none':'block'}">Bootstrap dan kandidat diacak otomatis di setiap node.</p>
 <div class="man" style="display:${o.mode=='manual'?'block':'none'}"><label class="muted">ID baris bootstrap</label><textarea rows="2">${esc(o.ids)}</textarea>
 <label class="muted">Fitur kandidat per iterasi (satu baris per iterasi, pisahkan koma)</label><textarea rows="5">${esc(o.cands||'')}</textarea></div></div>`}).join('');
 $$('.tcfg select').forEach(s=>s.onchange=()=>{const t=s.closest('.tcfg'),m=s.value=='manual';t.querySelector('.man').style.display=m?'block':'none';t.querySelector('.hint').style.display=m?'none':'block'})}
$('#addRow').onclick=()=>{sync();S.rows.push([...S.features.map(()=>''),'']);drawTable()};
$('#addCol').onclick=()=>{sync();S.features.push('Fitur '+(S.features.length+1));S.rows.forEach(r=>r.splice(r.length-1,0,''));S.target.push('');drawTable();drawCfg()};
$('#reset').onclick=reset;
$('#build').onclick=async()=>{sync();$('#err').textContent='';const b=$('#build');b.disabled=true;b.innerHTML='<span class="spin"></span>Menumbuhkan hutan...';
 const trees=$$('.tcfg').map(e=>({mode:e.querySelector('select').value,ids:e.querySelectorAll('textarea')[0].value,cands:e.querySelectorAll('textarea')[1].value}));
 try{const r=await fetch('/api/build',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({features:S.features,rows:S.rows,target:S.target,trees,m:$('#m').value,seed:$('#seed').value})});
 const d=await r.json();await new Promise(x=>setTimeout(x,700));if(!r.ok)$('#err').textContent='Oops: '+d.error;else{render(d);burst()}}
 catch(e){$('#err').textContent='Oops: server tidak merespons.'}
 b.disabled=false;b.textContent='Bangun Random Forest'};
function entStr(p,q){const t=p+q;if(!p||!q)return 'Karena P = 0 atau N = 0, Entropy = 0';if(p==q)return 'Karena P = N, Entropy = 1';
 return `-(${p}/${t})·log₂(${p}/${t}) - (${q}/${t})·log₂(${q}/${t})`}
function treeHTML(n,d=0){if(n.leaf!==undefined)return `<span class="leaf">Kelas: ${esc(n.leaf)}</span>`;
 return `<span class="nd d${d%5}">${esc(n.feature)} ?</span><ul>`+Object.entries(n.children).map(([v,c])=>`<li><span class="ev">${esc(v)}</span>${treeHTML(c,d+1)}</li>`).join('')+'</ul>'}
function stepHTML(s,d){const row=r=>`<tr><td>P${r.id}</td>`+S.features.map(f=>`<td${s.cand.includes(f)?' class="cand"':''}>${esc(r.x[f])}</td>`).join('')+`<td>${esc(r.y)}</td></tr>`;
 return `<details ${s.i==1?'open':''}><summary>Iterasi ${s.i} <span class="tag">Konteks: ${esc(s.path)}</span></summary>
 <p>Fitur tersedia: <b>${s.avail.map(esc).join(', ')}</b><br>Fitur kandidat: <span class="tag">${s.cand.map(esc).join(', ')}</span></p>
 <div class="scroll"><table><tr><th>Data</th>${S.features.map(f=>`<th>${esc(f)}${s.cand.includes(f)?' (kandidat)':''}</th>`).join('')}<th>Kelas</th></tr>${s.rows.map(row).join('')}</table></div>
 <h4>Entropy (S)</h4><div class="mono">P (${esc(d.pos)}) = ${s.p}, N = ${s.q}<br>${entStr(s.p,s.q)}<br>Entropy(S) = ${f6(s.base)}</div>
 ${s.feats.map(f=>`<h4 class="${f.name==s.best?'best':''}">${esc(f.name)}${f.name==s.best?' (terpilih)':''}</h4><div class="scroll"><table><tr><th>Nilai</th><th>Jumlah</th><th>${esc(d.pos)}</th><th>Bukan</th><th>Entropy</th><th>Split Info</th></tr>${f.values.map(v=>`<tr><td>${esc(v.v)}</td><td>${v.n}</td><td>${v.p}</td><td>${v.q}</td><td>${f6(v.e)}</td><td>${f6(v.si)}</td></tr>`).join('')}</table></div>
 <div class="mono">Gain = ${f6(s.base)} - (${f.values.map(v=>`${v.n}/${s.n}·${f6(v.e)}`).join(' + ')}) = ${f6(f.gain)}<br>Split Info = ${f6(f.si)}<br>Gain Ratio = ${f6(f.gain)} / ${f6(f.si)} = <b>${f6(f.gr)}</b></div>`).join('')}
 ${expl(s,d)}</details>`}
function expl(s,d){const b=s.feats.find(f=>f.name==s.best),o=s.feats.filter(f=>f!=b),tie=o.find(f=>Math.abs(f.gr-b.gr)<1e-9);
 const ch=b.values.map(v=>(v.p==0||v.q==0)?`<li><b>${esc(v.v)}</b>: ${v.n} data semuanya kelas ${esc(v.p?d.pos:d.other)}, menjadi daun.</li>`:`<li><b>${esc(v.v)}</b>: ${v.n} data masih campuran (${esc(d.pos)} = ${v.p}, ${esc(d.other)} = ${v.q}), dilanjutkan pada iterasi berikutnya atau diputuskan dengan suara terbanyak bila fitur habis.</li>`).join('');
 return `<div class="note"><b>Penjelasan:</b> <b>${esc(b.name)}</b> memiliki Gain Ratio tertinggi (${f6(b.gr)})${o.length?' dibanding '+o.map(f=>esc(f.name)+' ('+f6(f.gr)+')').join(', '):''}${tie?', nilainya seri sehingga dipilih fitur yang tertulis lebih dulu':''}, maka dipilih sebagai node pemisah. Hasil pemisahan:<ul>${ch}</ul></div>`}
function rules(n,p=[]){if(n.leaf!==undefined)return [`JIKA ${p.length?p.join(' DAN '):'(semua data)'} MAKA ${n.leaf}`];
 return Object.entries(n.children).flatMap(([v,c])=>rules(c,[...p,`${n.feature} = ${v}`]))}
function render(d){const T=d.trees;d.other=d.classes.find(c=>c!=d.pos);
 const inp=S.features.map((f,i)=>`${esc(f)} = ${esc(S.target[i])}`).join(', ');
 $('#out').innerHTML=`<div class="card"><h3>Hasil Mayoritas Vote</h3><div class="votes">${T.map((t,i)=>`<div class="vote ${t.pred==d.pos?'y':'n'}" style="animation-delay:${i*.2}s"><span>${i+1}</span><b>Pohon ${i+1}</b><em>${esc(t.pred)}</em></div>`).join('')}</div>
 <p style="text-align:center">Suara: ${Object.entries(d.votes).map(([k,v])=>`${esc(k)} = ${v}`).join(', ')}. Prediksi Hutan: <b class="best" style="font-size:1.4rem">${esc(d.final)}</b></p>
 <div class="note"><b>Kesimpulan:</b> dengan data baru (${inp}), ${Object.entries(d.votes).map(([k,v])=>v+' pohon memprediksi '+esc(k)).join(' dan ')}. Berdasarkan suara mayoritas, hasil klasifikasi adalah <b>${esc(d.final)}</b>.</div></div>
 <div class="card"><div class="tabs">${T.map((_,i)=>`<button data-tab="${i}" class="${i?'':'on'}">Pohon ${i+1}</button>`).join('')}</div>
 ${T.map((t,i)=>`<div class="tp" data-p="${i}" style="display:${i?'none':'block'}"><p><b>Baris bootstrap:</b> ${t.ids.join(', ')}<br><span class="muted">Out-of-bag: ${t.oob.length?t.oob.join(', '):'-'}</span></p>
 <p><b>Prediksi pohon: <span class="best">${esc(t.pred)}</span></b> (jalur: ${t.trail.map(esc).join(' → ')||'-'})</p>
 <div class="scroll"><ul class="tree"><li>${treeHTML(t.tree)}</li></ul></div><h4>Aturan Keputusan</h4><div class="mono">${rules(t.tree).map(esc).join('<br>')}</div><h4>Langkah Perhitungan (klik untuk membuka)</h4>${t.steps.map(s=>stepHTML(s,d)).join('')}</div>`).join('')}</div>`;
 $$('[data-tab]').forEach(b=>b.onclick=()=>{$$('[data-tab]').forEach(x=>x.classList.toggle('on',x==b));$$('.tp').forEach(p=>p.style.display=p.dataset.p==b.dataset.tab?'block':'none')});
 $('#out').scrollIntoView({behavior:'smooth'})}
$$('.fc').forEach(c=>c.onclick=()=>c.classList.toggle('on'));
const Q=[["Entropy bernilai 0 artinya...",["Dua kelas sama banyak","Data hanya satu kelas","Data kosong"],1,"Entropy 0 berarti data murni, hanya satu kelas."],
["Apa itu bootstrap sampling?",["Mengambil n data acak dengan pengembalian","Menghapus data duplikat","Mengurutkan data"],0,"Ada data yang terambil lebih dari sekali dan ada yang tidak terambil."],
["Jika hasil 3 pohon adalah Tidak, Tidak, Ya, maka hutan memutuskan...",["Ya","Tidak","Seri"],1,"Mayoritas vote: 2 suara Tidak mengalahkan 1 suara Ya."]];
$('#quiz').innerHTML=Q.map((q,i)=>`<div class="qq"><p><b>${i+1}. ${q[0]}</b></p>${q[1].map((o,j)=>`<button class="qo" data-q="${i}" data-o="${j}">${o}</button>`).join('')}<p class="qx"></p></div>`).join('');
$$('.qo').forEach(b=>b.onclick=e=>{const i=+b.dataset.q,j=+b.dataset.o,box=b.closest('.qq');if(box.dataset.done)return;box.dataset.done=1;
 const ok=j==Q[i][2];b.classList.add(ok?'ok':'no');if(!ok)box.querySelectorAll('.qo')[Q[i][2]].classList.add('ok');
 box.querySelector('.qx').textContent=(ok?'Benar! ':'Belum tepat. ')+Q[i][3];if(ok)burst(e.clientX,e.clientY,16)});
document.addEventListener('click',e=>{if(!e.target.closest('.qo,#build'))burst(e.clientX,e.clientY,7)});
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add('in');io.unobserve(e.target)}),{threshold:.15});
$$('.rv').forEach(el=>io.observe(el));
$$('.num').forEach(el=>{const n=+el.dataset.n;let k=0;const t=setInterval(()=>{el.textContent=++k;if(k>=n)clearInterval(t)},90)});
const secs=['studi','simulasi','teori','kuis','eksperimen','faq'].map(id=>document.getElementById(id));
addEventListener('scroll',()=>{const h=document.documentElement;$('#bar').style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';
 let cur='';secs.forEach(s=>{if(s.getBoundingClientRect().top<160)cur=s.id});$$('nav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')=='#'+cur))});
reset();