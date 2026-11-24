let NODES=[], EDGES=[], EVENTS=[];
let curPerson=null, personSort='no', personFilter='', eventFilter='全部';
const adj={};
const ETYPES=['爆料','冲突','指控','结盟','占卜','直播','身份','进出','钱','其他'];
const el=id=>document.getElementById(id);

// 幽灵 click 防护（2026-09-23 根因）：手机上 pointerup 触发跳页后，浏览器约 300ms 内
// 会补发一次"兼容 click"，落点正好压在新页面的列表行上 → 点 A 却选中 B。
// 只吃"跳页点按 700ms 内、落点 40px 内"的 click，正常点按不受影响。
let lastTapPt=null;
document.addEventListener('click',e=>{
  if(lastTapPt&&Date.now()-lastTapPt.t<700&&
     Math.hypot(e.clientX-lastTapPt.x,e.clientY-lastTapPt.y)<40){
    e.preventDefault();e.stopPropagation();
  }
},true);
function markTap(e){if(e&&isFinite(e.clientX))lastTapPt={x:e.clientX,y:e.clientY,t:Date.now()};}

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function etypePill(t){return `<span class="etype">${esc(t)}</span>`;}

function natureTag(x){
  const map={'事实':'tag-fact','自称':'tag-self','占卜':'tag-div','猜测':'tag-doubt','存疑':'tag-doubt','记者评论':'tag-rep','我们的推断':'tag-neutral'};
  return `<span class="tag ${map[x]||'tag-neutral'}">${esc(x)}</span>`;
}

function highlight(t){
  let h=esc(t);
  h=h.replace(/⚠️材料声明/g,'<span class="warn">材料声明</span>');
  h=h.replace(/\[(事实)([^\]]*)\]/g,'<span class="tag tag-fact">[$1$2]</span>');
  h=h.replace(/\[(记者曰)([^\]]*)\]/g,'<span class="tag tag-rep">[$1$2]</span>');
  h=h.replace(/\[(自称)([^\]]*)\]/g,'<span class="tag tag-self">[$1$2]</span>');
  h=h.replace(/\[(占卜)([^\]]*)\]/g,'<span class="tag tag-div">[$1$2]</span>');
  h=h.replace(/\[(存疑)([^\]]*)\]/g,'<span class="tag tag-doubt">[$1$2]</span>');
  return h.split('\n').map(p=>`<p>${p}</p>`).join('');
}

// 人物小传 segments 渲染：有 url 的 chip 输出为可点击链接，无 url 保持纯文本 chip
function citeCls(label){
  if(label.startsWith('自称'))return 'tag-self';
  if(label.includes('记者曰'))return 'tag-rep';
  if(label.startsWith('事实'))return 'tag-fact';
  if(label.startsWith('占卜'))return 'tag-div';
  if(label.startsWith('存疑'))return 'tag-doubt';
  return 'tag-neutral';
}
function renderSegs(segs){
  if(!segs||!segs.length)return '';
  let h='';
  for(const s of segs){
    if(s.t==='text'){
      h+=esc(s.x).replace(/⚠️材料声明/g,'<span class="warn">材料声明</span>');
    }else{
      const inner='['+esc(s.label)+']';
      h+=s.url
        ? `<a class="tag ${citeCls(s.label)} cite" href="${esc(s.url)}" target="_blank" rel="noopener">${inner}</a>`
        : `<span class="tag ${citeCls(s.label)}">${inner}</span>`;
    }
  }
  return h.split('\n').map(p=>`<p>${p}</p>`).join('');
}
function srcLink(url){return url?` <a class="src-link" href="${esc(url)}" target="_blank" rel="noopener">原文</a>`:'';}

/* ---------- 人物 ---------- */
/* B站默认头像（小电视）：矢量重绘，任意尺寸清晰 */
const NOFACE_SVG=`<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
+`<rect width="180" height="180" fill="#eceef0"/>`
+`<line x1="72" y1="58" x2="55" y2="33" stroke="#c6c9cf" stroke-width="6" stroke-linecap="round"/>`
+`<line x1="108" y1="58" x2="125" y2="33" stroke="#c6c9cf" stroke-width="6" stroke-linecap="round"/>`
+`<rect x="34" y="56" width="112" height="70" rx="14" fill="none" stroke="#c6c9cf" stroke-width="6"/>`
+`<line x1="63" y1="85" x2="84" y2="91" stroke="#c6c9cf" stroke-width="6" stroke-linecap="round"/>`
+`<line x1="117" y1="85" x2="96" y2="91" stroke="#c6c9cf" stroke-width="6" stroke-linecap="round"/>`
+`<path d="M82,104 q4,5 8,0 q4,5 8,0" fill="none" stroke="#c6c9cf" stroke-width="4" stroke-linecap="round"/>`
+`<path d="M52,168 L62,126 L82,126 L90,140 L98,126 L118,126 L128,168 Z" fill="#c6c9cf"/>`
+`</svg>`;

function renderPeopleList(){
  const box=el('plist'); box.innerHTML='';
  let arr=NODES.filter(n=>{
    if(!personFilter) return true;
    const q=personFilter.toLowerCase();
    return n.name.toLowerCase().includes(q)||(n.aliases||[]).some(a=>a.toLowerCase().includes(q));
  });
  arr.sort((a,b)=>personSort==='no'?a.display_no-b.display_no:b.mention_count-a.mention_count);
  for(const n of arr){
    const d=document.createElement('div');
    d.className='prow'+(curPerson===n.name?' sel':'');
    d.innerHTML=`<div class="avatar">${NOFACE_SVG}</div>
      <div class="info"><div class="nm"><span class="no">#${n.display_no}</span>${esc(n.name)}</div>
      <div class="imp">${esc(n.impression||'')}</div></div>
      <span class="mc">${n.mention_count}次</span>`;
    d.onclick=()=>showPerson(n.name);
    box.appendChild(d);
  }
}

function showPerson(name){
  curPerson=name;
  const n=NODES.find(x=>x.name===name); if(!n) return;
  renderPeopleList();
  const rel=(adj[name]||[]).slice().sort((a,b)=>b.weight-a.weight).slice(0,8);
  const evs=EVENTS.filter(e=>(e.people||[]).includes(name)).slice().reverse();
  const fam=n.q_familiarity==null?'—':Math.round(n.q_familiarity*100)+'%';
  const aff=n.q_affection==null?'待定':(n.q_affection>0?'+':'')+n.q_affection;
  el('pdetail').innerHTML=`
    <h2>${esc(n.name)}</h2>
    <div class="meta">#${n.display_no} · 提及 ${n.mention_count} 次${n.aliases&&n.aliases.length?' · 别名：'+esc(n.aliases.join('、')):''}</div>
    <div class="lead">${esc(n.impression)}</div>
    <div class="bio">${renderSegs(n.bio_segs&&n.bio_segs.length?n.bio_segs:null)||highlight(n.bio)}</div>
    <div class="qbar"><span>熟悉度 ${fam}</span><span>好感度 ${aff}</span></div>
    <div class="quotes"><h3>代表原文</h3>${(n.quotes||[]).map(q=>
      `<div class="quote">${esc(q.text)}<div class="qd">${esc(q.date||'')}${q.did?` · <a class="src-link" href="https://t.bilibili.com/${esc(q.did)}" target="_blank" rel="noopener">原文</a>`:''}</div></div>`).join('')||'<div class="quote">暂无</div>'}</div>
    <div class="rel-ev"><h3>相关事件（${evs.length}）</h3>${evs.map(e=>
      `<a class="evlink" href="javascript:void(0)" onclick="gotoEvent(${e.id})"><span class="t">${esc(e.date)}</span>${esc(e.title)}</a>`).join('')||'暂无'}</div>
    <div class="rel-p"><h3>关系人 Top${rel.length}</h3>${rel.map(r=>
      `<span class="plink" onclick="showPerson('${esc(r.name)}')">${esc(r.name)} <span class="w">· ${r.weight}</span></span>`).join('')||'暂无'}</div>`;
  if(window.innerWidth<760) el('pdetail').scrollIntoView({behavior:'smooth',block:'start'});
}
function revealPersonRow(){ // 列表滚到被选中的那行，让“同步选中”看得见
  requestAnimationFrame(()=>{
    const s=document.querySelector('#plist .prow.sel');
    if(s) s.scrollIntoView({behavior:'smooth',block:'center'});
  });
}

/* ---------- 事件轴 ---------- */
function renderTypeFilters(){
  const box=el('etype-filters'); box.innerHTML='';
  ['全部',...ETYPES].forEach(t=>{
    const b=document.createElement('button');
    b.textContent=t+(t==='全部'?'':` ${EVENTS.filter(e=>e.event_type===t).length}`);
    b.className=eventFilter===t?'on':'';
    b.onclick=()=>{eventFilter=t;renderTypeFilters();renderEvents();};
    box.appendChild(b);
  });
}
function renderEvents(){
  const box=el('elist'); box.innerHTML='';
  const arr=EVENTS.filter(e=>eventFilter==='全部'||e.event_type===eventFilter).slice().reverse();
  for(const e of arr){
    const d=document.createElement('div');
    d.className='ecard'; d.id='ev'+e.id;
    const de=e.date_end&&e.date_end!==e.date?`${e.date} ~ ${e.date_end}`:e.date;
    d.innerHTML=`
      <div class="ecard-head" onclick="document.getElementById('ev${e.id}').classList.toggle('open')">
        <div class="emeta">${etypePill(e.event_type)}<span class="edate">${esc(de)}</span><span class="eimp">重要度 ${e.importance||3}/5</span></div>
        <div class="etitle">${esc(e.title)}</div>
      </div>
      <div class="ecard-body">
        <div class="nature">${(e.nature||[]).map(natureTag).join('')}</div>
        <div class="bio">${renderSegs(e.summary_segs&&e.summary_segs.length?e.summary_segs:null)||highlight(e.summary)}</div>
        <div style="margin:12px 0 4px">${(e.people||[]).map(p=>`<span class="plink" onclick="markTap(event);showPerson('${esc(p)}');switchTab('people');revealPersonRow()">${esc(p)}</span>`).join('')}</div>
        <div class="evsec">证据（${e.evidence.length}）</div>
        ${e.evidence.map(v=>`<div class="evi"><div class="eh"><b>${esc(v.reporter)}</b> · ${esc(v.date)}${srcLink(v.url)}</div>${esc(v.text)}</div>`).join('')}
      </div>`;
    box.appendChild(d);
  }
}
function gotoEvent(id){
  switchTab('events');
  const e=EVENTS.find(x=>x.id===id); if(!e) return;
  if(eventFilter!=='全部'&&e.event_type!==eventFilter){eventFilter='全部';renderTypeFilters();renderEvents();}
  const card=el('ev'+id); if(!card) return;
  card.classList.add('open','flash');
  setTimeout(()=>card.classList.remove('flash'),1700);
  card.scrollIntoView({behavior:'smooth',block:'center'});
}

/* ---------- 星图：3D天球仪（从外面看，真实亮星排布） ---------- */
let graphInit=false;
async function initGraph(){
  if(graphInit) return; graphInit=true;
  function showGraphFail(msg){
    loading.style.display='none'; fallback.style.display='flex';
    const sub=fallback.querySelector('.fb-sub');
    if(sub)sub.textContent=msg;
    graphInit=false; // 允许点"重试"按钮再跑一次
  }
  const loading=el('graphLoading'), fallback=el('graphFallback'),
        tip=el('gtooltip'), container=el('graph3d');
  if(!NODES.length){graphInit=false;return;} // 数据未到：下次切 tab 重试

  let THREE;
  try{
    THREE=await Promise.race([
      import('three'),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('CDN timeout')),15000))
    ]);
  }catch(err){
    showGraphFail('3D 库加载失败（CDN 不可达或超时 15 秒）：'+err.message+'。请检查网络后重试。');
    return;
  }

  // WebGL 预检：PC 老机器/远程桌面/被禁用硬件加速时直接给明确提示，不无限转圈
  try{
    const _wc=document.createElement('canvas');
    if(!(_wc.getContext('webgl2')||_wc.getContext('webgl')))throw new Error('unavailable');
  }catch(wgl){
    showGraphFail('当前浏览器不支持 WebGL（3D 加速）。请换 Chrome/Edge 试试，或检查浏览器设置里是否关闭了"硬件加速"。');
    return;
  }

  try{ // setup 全程兜底：任何一步抛异常都显示可读错误，不卡"正在展开天球"

  // 42 颗真实亮星：中文名,视星等,赤经(°),赤纬(°),星色（同 v7/v8）
  const STARS_RAW=[
    ['天狼星',-1.46,101.28,-16.72,'#cfe4ff'],['大角星',-0.05,213.91,19.18,'#ffd9a0'],
    ['织女星',0.03,279.23,38.78,'#bcd2ff'],['五车二',0.08,79.17,46.00,'#ffe9c4'],
    ['参宿七',0.13,78.63,-8.20,'#b9cfff'],['南河三',0.34,114.83,5.22,'#fff4d6'],
    ['参宿四',0.50,88.79,7.41,'#ffb27a'],['河鼓二',0.76,297.70,8.87,'#dfe9ff'],
    ['毕宿五',0.85,68.98,16.51,'#ffc78f'],['心宿二',0.96,247.35,-26.43,'#ff9d7a'],
    ['角宿一',0.97,201.30,-11.16,'#c3d4ff'],['北河三',1.14,116.33,28.03,'#ffdf9e'],
    ['天津四',1.25,310.36,45.28,'#d7e4ff'],['轩辕十四',1.35,152.09,11.97,'#d5e2ff'],
    ['弧矢七',1.50,104.66,-28.97,'#bfd0ff'],['北河二',1.58,113.65,31.89,'#e8f0ff'],
    ['参宿五',1.64,81.28,6.35,'#c9d8ff'],['五车五',1.65,81.57,28.61,'#e2ecff'],
    ['参宿二',1.69,84.05,-1.20,'#d0ddff'],['玉衡',1.77,193.51,55.96,'#e6ecff'],
    ['天枢',1.79,165.93,61.75,'#ffe3ae'],['天船三',1.79,51.08,49.86,'#fff0c8'],
    ['军市一',1.98,95.67,-17.96,'#c8d6ff'],['摇光',1.86,206.97,49.31,'#dfe8ff'],
    ['五车三',1.90,89.88,44.95,'#ffedbe'],['井宿三',1.92,99.43,16.41,'#eef3ff'],
    ['娄宿三',2.00,31.79,23.46,'#ffd2a0'],['土司空',2.04,10.90,-17.99,'#ffe9c0'],
    ['壁宿二',2.06,2.10,29.09,'#dbe6ff'],['奎宿九',2.07,17.43,35.62,'#ffc79a'],
    ['候',2.08,263.73,12.56,'#e8f0ff'],['轩辕十二',2.08,154.99,19.84,'#ffdf9e'],
    ['帝',2.08,222.68,74.16,'#ffd9a8'],['大陵五',2.09,47.04,40.96,'#e4ecff'],
    ['五帝座一',2.11,177.26,14.57,'#e9efff'],['开阳',2.23,200.98,54.93,'#e6ecff'],
    ['王良四',2.24,10.13,56.54,'#ffc79a'],['天棓四',2.24,269.15,51.49,'#ffdf9e'],
    ['天大将军',2.26,30.97,42.33,'#ffd9a0'],['王良二',2.27,2.29,59.15,'#fff3d0'],
    ['危宿三',2.38,326.05,9.88,'#ffe9c4'],['室宿二',2.42,345.94,28.08,'#ffc79a'],
  ].map(s=>({name:s[0],mag:s[1],ra:s[2],dec:s[3],color:s[4]})).sort((a,b)=>a.mag-b.mag);
  const POLARIS={name:'勾陈一',mag:1.98,ra:37.95,dec:89.26,color:'#fff4d6'};

  // 人物→星星：主角=北极星（球顶）；其余按提及数从高到低→星等从亮到暗
  const byHot=[...NODES].sort((a,b)=>b.mention_count-a.mention_count);
  const main=NODES.find(n=>n.name==='主角')||byHot[0];
  const others=[...NODES].filter(n=>n!==main)
    .sort((a,b)=>(b.mention_count-a.mention_count)||(a.display_no-b.display_no));
  const pairs=[{person:main,star:POLARIS,isMain:true}];
  others.slice(0,STARS_RAW.length).forEach((p,i)=>pairs.push({person:p,star:STARS_RAW[i],isMain:false}));

  const R=100, D2R=Math.PI/180, TILT=23.5*D2R;
  const globePos=(ra,dec)=>{ // 球外表面：北天极=+Y（从外面看即天球仪的镜像画法）
    const a=ra*D2R, d=dec*D2R, cd=Math.cos(d);
    return new THREE.Vector3(cd*Math.cos(a)*R, Math.sin(d)*R, -cd*Math.sin(a)*R);
  };

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(52,1,1,4000);
  const renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  renderer.setClearColor(0x070b18,1);
  container.appendChild(renderer.domElement);
  const cv=renderer.domElement;

  // 相机：在外面看，视线略俯；滚轮=沿视线推拉
  const lookAt=new THREE.Vector3(0,6,0);
  const camDir=new THREE.Vector3(0,0.20,1).normalize();
  let camDist=340; // 球约占视口高度 60%
  function updateCamera(){
    camera.position.copy(lookAt).addScaledVector(camDir,camDist);
    camera.lookAt(lookAt);
  }
  updateCamera();

  // 层级：grabGroup（arcball 万向抓动，无钳制）> tilt（地轴倾斜 23.5° 固定）> spin（绕极轴自转）> 内容
  const grabGroup=new THREE.Group(); scene.add(grabGroup);
  grabGroup.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI); // 初始：天狼星一侧朝前（与旧 yaw=π 一致）
  const tilt=new THREE.Group(); tilt.rotation.z=TILT; grabGroup.add(tilt);
  const spin=new THREE.Group(); tilt.add(spin);

  // 玻璃球体（极淡）+ 经纬网 + 地轴线
  const ball=new THREE.Mesh(new THREE.SphereGeometry(R,48,32),
    new THREE.MeshBasicMaterial({color:0x2a3560,transparent:true,opacity:0.05,depthWrite:false}));
  spin.add(ball);
  const gridMatD=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.05,depthWrite:false});
  const gridMatR=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.04,depthWrite:false});
  const GR=R*1.002;
  for(const dec of [75,60,45,30,15,0,-15,-30]){
    const d=dec*D2R, cd=Math.cos(d), pts=[];
    for(let i=0;i<=120;i++){
      const a=i/120*Math.PI*2;
      pts.push(new THREE.Vector3(cd*Math.cos(a)*GR,Math.sin(d)*GR,-cd*Math.sin(a)*GR));
    }
    spin.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),gridMatD));
  }
  for(let h=0;h<12;h++){
    const a=h*30*D2R, pts=[];
    for(let d=-78;d<=78;d+=4){
      const dd=d*D2R, cd=Math.cos(dd);
      pts.push(new THREE.Vector3(cd*Math.cos(a)*GR,Math.sin(dd)*GR,-cd*Math.sin(a)*GR));
    }
    spin.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gridMatR));
  }
  { // 地轴线：穿过两极，随球一起倾斜
    const g=new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(0,-R*1.35,0),new THREE.Vector3(0,R*1.35,0)]);
    spin.add(new THREE.Line(g,new THREE.LineBasicMaterial({
      color:0xffffff,transparent:true,opacity:0.15,depthWrite:false})));
  }

  // 共享纹理：亮星十字芒 / 柔光 / 小星（tint 上色）
  function glowTex(size,spikes){
    const c=document.createElement('canvas'); c.width=c.height=size;
    const g=c.getContext('2d'), m=size/2;
    const gr=g.createRadialGradient(m,m,0,m,m,m);
    gr.addColorStop(0,'rgba(255,255,255,1)');
    gr.addColorStop(0.16,'rgba(255,255,255,0.9)');
    gr.addColorStop(0.42,'rgba(255,255,255,0.20)');
    gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr; g.fillRect(0,0,size,size);
    if(spikes){
      g.lineWidth=1.5; g.strokeStyle='rgba(255,255,255,0.55)';
      const L=size*0.47;
      g.beginPath();
      g.moveTo(m-L,m); g.lineTo(m+L,m);
      g.moveTo(m,m-L); g.lineTo(m,m+L);
      g.stroke();
      g.lineWidth=1; g.strokeStyle='rgba(255,255,255,0.22)';
      const L2=size*0.24;
      g.beginPath();
      g.moveTo(m-L2,m-L2); g.lineTo(m+L2,m+L2);
      g.moveTo(m+L2,m-L2); g.lineTo(m-L2,m+L2);
      g.stroke();
    }
    return new THREE.CanvasTexture(c);
  }
  const texSpike=glowTex(128,true), texSoft=glowTex(96,false), texSmall=glowTex(64,false);
  function ringTex(){
    const s=128,c=document.createElement('canvas'); c.width=c.height=s;
    const g=c.getContext('2d');
    g.strokeStyle='#e8c26a'; g.lineWidth=5;
    g.beginPath(); g.arc(s/2,s/2,s/2-9,0,Math.PI*2); g.stroke();
    return new THREE.CanvasTexture(c);
  }
  const FONT='"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  function labelTex(text,gold){
    const c=document.createElement('canvas'); c.width=256; c.height=32;
    const g=c.getContext('2d');
    g.textAlign='center'; g.textBaseline='middle';
    g.shadowColor='rgba(3,6,14,0.9)'; g.shadowBlur=5;
    g.font='600 22px '+FONT;
    g.fillStyle=gold?'#e8c26a':'rgba(245,248,252,0.95)';
    g.fillText(text,128,17);
    const tex=new THREE.CanvasTexture(c);
    return {tex,tw:g.measureText(text).width}; // tw: 文字实际宽度(canvas px)，供标签点选
  }

  const starSize=mag=>Math.min(7,Math.max(1.2,1.6*Math.pow(2.512,(1.5-mag)/2)));
  const labels=[];

  for(const p of pairs){
    const pos=globePos(p.star.ra,p.star.dec);
    const dir=pos.clone().normalize();
    const s=starSize(p.star.mag)*(p.isMain?1.6:1);
    const tex=p.star.mag<1.0?texSpike:(p.star.mag<1.8?texSoft:texSmall);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({
      map:tex,color:p.star.color,transparent:true,depthWrite:false}));
    sp.position.copy(pos); sp.scale.set(s,s,1);
    spin.add(sp);
    p.starSp=sp; p.starMat=sp.material; // 2026-09-23 点选修复：存下小球材质，随标签一起淡出
    if(p.isMain){ // 主角：稍大光晕
      const halo=new THREE.Sprite(new THREE.SpriteMaterial({
        map:texSoft,color:'#fff4d6',transparent:true,opacity:0.22,depthWrite:false}));
      halo.position.copy(pos); halo.scale.set(s*3.4,s*3.4,1); spin.add(halo);
      p.halo=halo; p.haloMat=halo.material;
    }
    const nm=p.isMain?'主角':p.person.name;
    const lt=labelTex(nm,false);
    const lm=new THREE.SpriteMaterial({map:lt.tex,
      transparent:true,depthWrite:false});
    const lb=new THREE.Sprite(lm);
    lb.position.copy(pos).addScaledVector(dir,s*0.5+4);
    lb.scale.set(26,3.25,1); lb.renderOrder=10;
    spin.add(lb);
    p.label=lb; p.labelMat=lm; p.labelTw=lt.tw; labels.push(p);
  }

  // 150 颗装饰远星（纯背景，世界空间静止）
  let decoMat;
  {
    const n=150, arr=new Float32Array(n*3);
    let sd=20260923; const rnd=()=>((sd=(sd*1103515245+12345)&0x7fffffff)/0x7fffffff);
    for(let i=0;i<n;i++){
      const v=new THREE.Vector3(rnd()*2-1,rnd()*2-1,rnd()*2-1).normalize()
        .multiplyScalar(600+rnd()*300);
      arr[i*3]=v.x; arr[i*3+1]=v.y; arr[i*3+2]=v.z;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(arr,3));
    decoMat=new THREE.PointsMaterial({color:0xaebadd,size:1.6,
      transparent:true,opacity:0.45,depthWrite:false});
    scene.add(new THREE.Points(g,decoMat));
  }

  function resize(){
    const w=container.clientWidth,h=container.clientHeight;
    if(!w||!h) return;
    camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h);
  }
  window.addEventListener('resize',resize); resize();
  window.__ziGraphResize=resize;

  // 交互：arcball 万向抓动（无钳制）+ 克制惯性 / 滚轮双指推拉 / 点击拜访
  let dragging=false, idleT=99, angW=0, spinAngle=0; // angW：惯性角速度（rad/帧），angAxis：世界系旋转轴
  const angAxis=new THREE.Vector3(0,1,0);
  let downX=0, downY=0, downT=0, moved=0, hoverEv=null;
  const AUTO_W=Math.PI*2/360; // 约 6 分钟一周；从北极上空俯视为顺时针
  const ptrs=new Map(); let pinchD=0;
  const VMAX=0.05, VMIN=0.0003; // 惯性：上限 0.05 rad/帧（满速甩动约 48°，与旧版一致），阈值下停止；0.94/帧衰减

  // arcball：屏幕点 → 相机空间虚拟球面点（按短边归一化，保持球形）
  const _qa=new THREE.Vector3(), _qb=new THREE.Vector3(), _ax=new THREE.Vector3();
  const _q=new THREE.Quaternion();
  function ballVec(cx,cy,r){
    const m=Math.min(r.width,r.height)/2;
    let x=(cx-r.left-r.width/2)/m, y=-(cy-r.top-r.height/2)/m;
    const r2=x*x+y*y;
    let z;
    if(r2<=1){z=Math.sqrt(1-r2);}
    else{const s=1/Math.sqrt(r2);x*=s;y*=s;z=0;}
    return new THREE.Vector3(x,y,z);
  }

  const _v1=new THREE.Vector3(), _v2=new THREE.Vector3(), _camd=new THREE.Vector3(), _lv=new THREE.Vector3();
  const TAP_MARGIN=12; // px：文字标签点按外扩边距；标签本身已是较大目标
  const BALL_MARGIN=8; // px：星球小球点按外扩边距；按"可见大小"精确绑定，不放大
  const ZI_VER='20260923q'; // 与 index.html 的 ?v= 同步；?dbg=1 时显示在调试层
  const DBG=/[?&]dbg=1/.test(location.search);
  let dbgBox=null;
  if(DBG){
    dbgBox=document.createElement('div');
    dbgBox.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99;max-width:92vw;max-height:38vh;overflow:auto;background:rgba(10,12,25,.92);color:#cfe3ff;font:11px/1.5 monospace;padding:8px 10px;border:1px solid #3a4a7a;border-radius:8px;pointer-events:none;white-space:pre-wrap;';
    dbgBox.textContent='zi '+ZI_VER+'（调试层：点任意星看判定）';
    document.body.appendChild(dbgBox);
  }
  function dbg(msg){if(dbgBox)dbgBox.textContent='zi '+ZI_VER+'\n'+msg;}
  // ---------- 点选（2026-09-23 重写）：只认"点中"，重叠时最小目标胜 ----------
  // 候选 = 触点落在某人"可见圆盘"或"文字矩形"内；多候选时按命中面积从小到大排，
  // 面积最小者胜（点小球不会被旁边大佬的光晕/宽标签截胡），面积相同时离中心近者胜。
  // 背面已淡出的不可点（与淡出同阈值 0.25）；点空处返回 null，不兜底不乱跳。
  function pickAt(cx,cy){
    const r=cv.getBoundingClientRect();
    const px=cx-r.left, py=cy-r.top;
    if(!isFinite(px)||!isFinite(py)||r.width<=0||r.height<=0)return null;
    scene.updateMatrixWorld(true); // 确保用的是最新矩阵
    _camd.copy(camera.position).sub(lookAt).normalize(); // 相机朝向（与标签淡出同逻辑）
    const unitH=r.height/(2*Math.tan(camera.fov*0.5*Math.PI/180)); // 1 世界单位在 1 距离处 = ? px
    const cands=[];
    for(const p of pairs){
      p.label.getWorldPosition(_v1);
      _v2.copy(_v1).sub(lookAt).normalize();
      if(_camd.dot(_v2)<=0.25)continue; // 背面星剔除（与淡出同阈值）
      if(!p.label.visible||p.labelMat.opacity<=0.01)continue; // 双保险
      const dist=camera.position.distanceTo(_v1);
      if(!(dist>0)||!isFinite(dist))continue;
      const ppu=unitH/dist;
      // ① 星球可见圆盘：小球/光晕/金环取最大可见半径
      p.starSp.getWorldPosition(_v1);
      let visR=p.starSp.scale.x/2;
      if(p.halo)visR=Math.max(visR,p.halo.scale.x/2);
      if(p.ring)visR=Math.max(visR,p.ring.scale.x/2);
      _v2.copy(_v1).project(camera);
      if(isFinite(_v2.x)&&isFinite(_v2.y)&&_v2.z<=1){
        const bx=(_v2.x*0.5+0.5)*r.width, by=(-_v2.y*0.5+0.5)*r.height;
        const rr=visR*ppu+BALL_MARGIN;
        if(isFinite(rr)&&rr>0){
          const bd=Math.hypot(px-bx,py-by);
          if(bd<=rr)cands.push({p,area:Math.PI*rr*rr,d:bd,kind:'球'});
        }
      }
      // ② 文字标签矩形
      p.label.getWorldPosition(_v1);
      _v2.copy(_v1).project(camera);
      if(isFinite(_v2.x)&&isFinite(_v2.y)&&_v2.z<=1){
        const sx=(_v2.x*0.5+0.5)*r.width, sy=(-_v2.y*0.5+0.5)*r.height;
        const hw=(p.labelTw/256*26)/2*ppu+TAP_MARGIN; // 文字半宽（canvas 256px ↔ 精灵 26 单位）
        const hh=(22/32*3.25)/2*ppu+TAP_MARGIN;        // 文字半高（22px 字 ↔ 精灵 3.25 单位）
        if(isFinite(hw)&&isFinite(hh)&&hw>0&&hh>0){
          const dx=Math.abs(px-sx), dy=Math.abs(py-sy);
          if(dx<=hw&&dy<=hh)cands.push({p,area:4*hw*hh,d:Math.hypot(dx,dy),kind:'字'});
        }
      }
    }
    if(!cands.length){if(DBG)dbg('tap '+Math.round(px)+','+Math.round(py)+' → 空（点空处）');return null;}
    cands.sort((a,b)=>(a.area-b.area)||(a.d-b.d));
    const w=cands[0];
    if(DBG)dbg('tap '+Math.round(px)+','+Math.round(py)+' → '+w.p.person.name+'\n'+
      cands.slice(0,3).map(c=>c.p.person.name+'（'+c.kind+'）面积'+Math.round(c.area)+' 离中心'+c.d.toFixed(1)+'px').join('\n'));
    return {pair:w.p,rect:r};
  }
  function doHover(e){
    const r=cv.getBoundingClientRect(), found=pickAt(e.clientX,e.clientY);
    if(found){
      const p=found.pair;
      tip.style.left=(e.clientX-found.rect.left+14)+'px';
      tip.style.top=(e.clientY-found.rect.top-10)+'px';
      tip.textContent=p.person.name+
        ' · '+p.person.mention_count+'次';
      tip.style.display='block'; cv.style.cursor='pointer';
    }else{tip.style.display='none';cv.style.cursor='grab';}
  }

  cv.addEventListener('pointerdown',e=>{
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===2){
      const a=[...ptrs.values()];
      pinchD=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); dragging=false;
    }else{
      dragging=true; idleT=0; angW=0;
      downX=e.clientX; downY=e.clientY; downT=performance.now(); moved=0;
      cv.style.cursor='grabbing'; tip.style.display='none';
    }
  });
  cv.addEventListener('pointermove',e=>{
    if(ptrs.has(e.pointerId)){
      const prev=ptrs.get(e.pointerId);
      ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      moved=Math.max(moved,Math.hypot(e.clientX-downX,e.clientY-downY));
      if(ptrs.size===2){
        const a=[...ptrs.values()], d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
        if(pinchD>0){camDist=Math.min(520,Math.max(200,camDist*pinchD/Math.max(d,1)));updateCamera();idleT=0;}
        pinchD=d; return;
      }
      if(dragging){
        // arcball 万向抓动：前后两屏点 → 虚拟球面两向量，叉积为轴、夹角为转角
        // 无俯仰钳制，任意方向自由转动；轴换到世界系后 premultiply，保证抓点跟手
        const r=cv.getBoundingClientRect();
        _qa.copy(ballVec(prev.x,prev.y,r));
        _qb.copy(ballVec(e.clientX,e.clientY,r));
        _ax.crossVectors(_qa,_qb);
        const sin=_ax.length(), cos=_qa.dot(_qb);
        if(sin>1e-6){
          const ang=Math.atan2(sin,cos);
          _ax.applyQuaternion(camera.quaternion).normalize(); // 相机系 → 世界系
          _q.setFromAxisAngle(_ax,ang);
          grabGroup.quaternion.premultiply(_q).normalize(); // 归一化防漂移
          angW=0.7*angW+0.3*Math.min(ang,0.12); // 惯性：角速度 EMA，单步限幅防抖
          angAxis.copy(_ax);
        }
      }
    }else if(e.pointerType==='mouse'&&!dragging){hoverEv=e;}
  });
  function up(e){
    ptrs.delete(e.pointerId);
    if(ptrs.size<2)pinchD=0;
    if(dragging){
      dragging=false; cv.style.cursor='grab'; idleT=0;
      if(moved<8&&performance.now()-downT<600){ // 位移<8px 才算点按，否则是拖拽
        const found=pickAt(e.clientX,e.clientY);
        if(found){markTap(e);showPerson(found.pair.person.name);switchTab('people');revealPersonRow();}
      }
    }
  }
  cv.addEventListener('pointerup',up);
  cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{
    e.preventDefault(); idleT=0;
    camDist=Math.min(520,Math.max(200,camDist*(e.deltaY>0?1.08:0.92)));
    updateCamera();
  },{passive:false});
  cv.addEventListener('pointerleave',()=>{tip.style.display='none';});

  const clock=new THREE.Clock(), _wp=new THREE.Vector3(), _cd=new THREE.Vector3();
  (function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.05), t=clock.elapsedTime;
    if(!dragging){
      if(angW>VMIN){
        // 抬手惯性：沿松手前最后的旋转轴继续转，0.94/帧衰减；满速 0.05/(1-0.94)≈0.83rad≈48°
        _q.setFromAxisAngle(angAxis,Math.min(angW,VMAX));
        grabGroup.quaternion.premultiply(_q).normalize(); // 每帧归一化，防四元数漂移
        angW*=0.94; idleT=0;
      }else{angW=0;idleT+=dt;}
      if(idleT>8){spinAngle-=AUTO_W*dt;spin.rotation.y=spinAngle;} // 拖拽时暂停，松手 8 秒后恢复
    }
    updateCamera();
    _cd.copy(camera.position).sub(lookAt).normalize();
    for(const p of labels){ // 背过去的星星：小球/光晕/金环与标签一起淡出 —— 所见即所点
      // 2026-09-23 根因：背面星的小球透过透明球体仍可见，但点选剔除背面星（dot<=0.25），
      // 造成"看得见但点不中"，44px兜底还会乱开邻居。现在小球/光晕/金环与标签
      // 用同一阈值一起淡出：看不见=点不中，看得见=点得中。
      p.label.getWorldPosition(_wp).sub(lookAt).normalize();
      const o=Math.min(1,Math.max(0,(_cd.dot(_wp)-0.25)/0.25));
      if(Math.abs(p.labelMat.opacity-o)>0.01)p.labelMat.opacity=o;
      p.label.visible=o>0.01;
      const so=o; // 小球与标签同透明度
      if(Math.abs(p.starMat.opacity-so)>0.01)p.starMat.opacity=so;
      p.starSp.visible=so>0.01;
      if(p.halo){const ho=o*0.22; if(Math.abs(p.haloMat.opacity-ho)>0.01)p.haloMat.opacity=ho; p.halo.visible=o>0.01;}
      if(p.ring){const ro=o*0.95; if(Math.abs(p.ringMat.opacity-ro)>0.01)p.ringMat.opacity=ro; p.ring.visible=o>0.01;}
    }
    if(hoverEv){doHover(hoverEv);hoverEv=null;}
    decoMat.opacity=0.45+Math.sin(t*Math.PI*2/5)*0.06;
    renderer.render(scene,camera);
  })();

  loading.style.display='none';
  }catch(err){
    showGraphFail('星图初始化失败：'+(err&&err.message||err));
  }
}



/* ---------- 启动 ---------- */
const TAB_ORDER=['people','events','graph'];
function switchTab(v){
  const cur=document.querySelector('.tab.active');
  const d=TAB_ORDER.indexOf(v)-TAB_ORDER.indexOf(cur?cur.dataset.view:v);
  const dir=d>0?1:d<0?-1:0; // 1=左划进, -1=右划进, 0=点选
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  document.querySelectorAll('.view').forEach(s=>{
    const on=s.id==='view-'+v;
    s.classList.toggle('active',on);
    s.classList.remove('vin');
    if(on){
      s.style.setProperty('--sx',dir>0?'44px':dir<0?'-44px':'0px');
      s.style.setProperty('--sy',dir===0?'12px':'0px');
      void s.offsetWidth; // 重启动画
      s.classList.add('vin');
    }
  });
  if(v==='graph'){initGraph();if(window.__ziGraphResize)window.__ziGraphResize();}
  moveInd();
}
function moveInd(){
  const cur=document.querySelector('.tab.active');
  if(!cur)return;
  const x=cur.offsetLeft,w=cur.offsetWidth;
  ['tabbg','tabind'].forEach(id=>{
    const ind=document.getElementById(id);
    if(!ind)return;
    if(!ind._ok){ind.style.transition='none';ind._ok=true; // 首次直接定位，不飞入
      requestAnimationFrame(()=>{ind.style.transition='';});}
    ind.style.width=w+'px';
    ind.style.transform='translateX('+x+'px)';
  });
}
window.addEventListener('resize',moveInd);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(moveInd);
document.querySelectorAll('.tab[data-view]').forEach(b=>b.onclick=()=>switchTab(b.dataset.view));

/* ---------- 左右滑动切换页签 ---------- */
/* 2026-09-23 人物/事件轴/星图支持手指左右滑动切换 */
(function(){
  let sx=0, sy=0, st0=0, st=null;
  document.addEventListener('touchstart',e=>{
    if(e.touches.length!==1){st=null;return;}
    const t=e.touches[0]; sx=t.clientX; sy=t.clientY; st0=Date.now(); st=t.target;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!st) return;
    const t=e.changedTouches[0];
    const dx=t.clientX-sx, dy=t.clientY-sy, dt=Date.now()-st0, startEl=st; st=null;
    if(dt>500) return; // 慢拖多半是选中文字等精细操作，不切页
    if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.5) return; // 不是左右划
    if(startEl.closest){
      if(startEl.closest('#view-graph')) return; // 星图画布自己管拖拽
      if(startEl.closest('input,textarea,select')) return; // 输入框不抢
    }
    const cur=document.querySelector('.tab.active');
    const i=TAB_ORDER.indexOf(cur?cur.dataset.view:'events');
    const n=dx<0?i+1:i-1; // 左划→下一个，右划→上一个
    if(n>=0&&n<TAB_ORDER.length&&n!==i){markTap(t);switchTab(TAB_ORDER[n]);}
  },{passive:true});
})();
el('psearch').oninput=e=>{personFilter=e.target.value.trim();renderPeopleList();};
// 星图失败页"重试"：重置后重跑 initGraph（CDN import 有缓存，不会重复下载）
document.getElementById('graphRetry')?.addEventListener('click',()=>{
  const fb=el('graphFallback'), ld=el('graphLoading');
  if(fb)fb.style.display='none'; if(ld)ld.style.display='flex';
  graphInit=false; initGraph();
});
el('sortNo').onclick=()=>{personSort='no';el('sortNo').classList.add('on');el('sortHot').classList.remove('on');renderPeopleList();};
el('sortHot').onclick=()=>{personSort='hot';el('sortHot').classList.add('on');el('sortNo').classList.remove('on');renderPeopleList();};

const DATA_V='20260923g'; // 数据版本：每次更新data后+1，前端强制拉新，防缓存
Promise.all([
  fetch('data/nodes.json?v='+DATA_V).then(r=>r.json()),
  fetch('data/edges.json?v='+DATA_V).then(r=>r.json()),
  fetch('data/events.json?v='+DATA_V).then(r=>r.json()),
]).then(([n,e,ev])=>{
  NODES=n;EDGES=e;EVENTS=ev;
  for(const x of e){
    (adj[x.a]=adj[x.a]||[]).push({name:x.b,weight:x.weight});
    (adj[x.b]=adj[x.b]||[]).push({name:x.a,weight:x.weight});
  }
  renderPeopleList();renderTypeFilters();renderEvents();
  switchTab('events'); // 2026-09-23 默认停在事件轴列表
}).catch(err=>{
  document.body.innerHTML='<p style="padding:40px;color:#a33b3b">数据加载失败：'+esc(err.message)+'</p>';
});
