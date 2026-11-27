(async()=>{
// Load page sections kept in separate files (see sections/ folder)
await Promise.all([...document.querySelectorAll('[data-include]')].map(async el=>{
  try{const r=await fetch(el.dataset.include);if(!r.ok)throw new Error(r.status);el.outerHTML=await r.text();}
  catch(e){el.innerHTML='<p style="padding:24px;text-align:center">This section couldn\'t load. Open the site through a local web server (not by double-clicking index.html).</p>';}
}));

const officers=[["President","Jeffrey Weiss"],["Administrative VP","Hyman Grosberg"],["Programming VP","Cilla Grosberg"],["Membership VP","Stephanie Buckberg"],["Religious VP","Ben Wolf"],["Education VP","Melissa Druxman"],["Financial VP","Michael Auerbach"],["Treasurer","Joshua Lansky"],["Recording Secretary","Sheryl Tilles"]];
const members=["Saul Cohen","Debbie Finch","Adam Glaser","Shira Gorin","Mark Kaufman","Ira Kolmaister","Ivy Konel","Freda Krosnick","Stacy Levine","Ken Libby","Bess Teller","Phil Temkin"];
document.getElementById('officers').innerHTML=officers.map(([r,n])=>`<div class="person"><small>${r}</small><b>${n}</b></div>`).join('');
document.getElementById('members').innerHTML=members.map(n=>`<div class="person"><b>${n}</b></div>`).join('');

const up='sections/worship/';
const pad=n=>String(n).padStart(2,'0');
const track=n=>`<a href="${up}${pad(n)}-Track-${n}.mp3" aria-label="Track ${n}">${n}</a>`;
document.getElementById('maariv').innerHTML=[2,3,4,5,6,7,8,9,10,11,12,13].map(track).join('');
document.getElementById('mincha').innerHTML=[14,15,16,17,22,23].map(track).join('');

const S='https://rabbijonahlayman.blogspot.com/';
const sermons=[
 ["2024 · 5785",[["Rosh Hashanah Day 1: Abandonment","2024/10/rosh-hashanah-day-1-20245785-abandonment.html"],["Rosh Hashanah Day 2: Whose Narrative Is Right?","2024/10/rosh-hashanah-day-2-20245785-whose.html"],["Kol Nidre: Our Narrative","2024/10/kol-nidre-2024-5785-our-narrative.html"],["Yom Kippur Yizkor: We Must Still Have Hope","2024/10/yom-kippur-yizkor-2024-5785-we-must.html"]]],
 ["2023 · 5784",[["Rosh Hashanah Day 1: Loneliness","2023/09/rosh-hashanah-day-1-2023-5784.html"],["Rosh Hashanah Day 2: Chesed / Compassion","2023/09/rosh-hashanah-day-2-sermon-20235784.html"],["Kol Nidre: Antisemitism","2023/09/kol-nidre-2023-5784-antisemitism.html"],["Yom Kippur: Evil Makes Us Good","2023/09/yom-kippur-2023-5784-evil-makes-us-good.html"]]],
 ["2022 · 5783",[["Rosh Hashanah Day 1: Living Amidst Chaos","2022/10/rosh-hashanah-day-1-20225783-life.html"],["Rosh Hashanah Day 2: Belief in God","2022/10/rosh-hashanah-day-2-20225783-can-we.html"],["Kol Nidre: Lessons From 75 Years","2022/10/kol-nidre-20225783-lessons-from-75-years.html"],["Yom Kippur Yizkor: Writing an Ethical Will","2022/10/yom-kippur-yizkor-20225783-writing.html"]]],
 ["2021 · 5782",[["Rosh Hashanah Day 1: Survival","2021/09/rosh-hashanah-day-1-survival.html"],["Rosh Hashanah Day 2: Confronting Despair","2021/09/rosh-hashanah-day-2-confronting-despair.html"],["Kol Nidre","2021/09/kol-nidre-2021-5782.html"],["Yom Kippur Yizkor","2021/09/yom-kippur-yizkor-2021-5782.html"]]],
 ["2020 · 5781",[["Rosh Hashanah Day 1: The Effects of COVID-19","2020/09/rosh-hashanah-day-1-20205781-effects-of.html"],["Rosh Hashanah Day 2: God in a Time of Crisis","2020/09/rosh-hashanah-day-2-20205781-god-in.html"],["Kol Nidre: Can We Ever Become Antiracist?","2020/09/kol-nidre-can-we-ever-become-antiracist.html"],["Yom Kippur Yizkor: My Regular Place in Shul","2020/09/yom-kippur-yizkor-my-regular-place-in.html"]]],
 ["2019 · 5780",[["Rosh Hashanah Day 1","2019/10/rosh-hashanah-first-day-sermon.html"],["Rosh Hashanah Day 2","2019/10/rosh-hashanah-second-day-sermon.html"]]],
 ["2018 · 5779",[["Rosh Hashanah Day 1: Mental Health","2018/09/rosh-hashanah-day-1-2018-mental-health.html"],["Rosh Hashanah Day 2: Misplaced Trust","2018/09/rosh-hashanah-day-2-2018-misplaced-trust.html"],["Kol Nidre: Looking Back","2018/09/kol-nidre-2018-5779-looking-back-in.html"],["Yom Kippur Yizkor: Letting Go","2018/09/yom-kippur-yizkor-2018-5779-letting-our.html"]]],
 ["2017 · 5778",[["Rosh Hashanah Day 1","2017/09/rosh-hashanah-sermon-day-1-2017-5778.html"],["Rosh Hashanah Day 2","2017/09/rosh-hashanah-day-2-2017-5778.html"],["Kol Nidre","2017/10/kol-nidre-sermon-2017-5778.html"],["Yom Kippur Yizkor","2017/10/yom-kippur-yizkor-sermon-2017-5778.html"]]],
 ["2016 · 5777",[["Rosh Hashanah Day 1","2016/10/rosh-hashanah-2016-sermon-on-day-1.html"],["Rosh Hashanah Day 2","2016/10/rosh-hashanah-2016-sermon-on-day-2.html"],["Kol Nidre","2016/10/klo-nidre-sermon-2016.html"],["Yom Kippur Yizkor","2016/10/yom-kippur-yizkor-sermon-2016.html"]]],
 ["2015 · 5776",[["Rosh Hashanah Day 1","https://docs.google.com/document/d/1_314TtLfrl5COSv6L0EFDlWNrt797NilP9wFb98Gpis/edit"],["Rosh Hashanah Day 2","https://docs.google.com/document/d/14EacPve9BJHqI9BeSAtrEJHDSZWDP5VjWP3U0xGrt40/edit"],["Kol Nidre","https://docs.google.com/document/d/1ucHV-TAVdratSs0N2QEwCK1hp-DOxXsA2OO8_rXUt3I/edit"],["Yom Kippur Yizkor","https://docs.google.com/document/d/1lIn3MxGyO6qptL02SE2FSwvxAOHrhAs5XHddcI471Lc/edit"]]]
];
document.getElementById('sermonList').innerHTML=sermons.map(([y,l],i)=>`<details${i===0?' open':''}><summary>${y}</summary><div><ul>${l.map(([t,u])=>`<li><a href="${u.startsWith('http')?u:S+u}">${t}</a></li>`).join('')}</ul></div></details>`).join('');

const F='sections/news-and-events/';
const issues=[["September 2026","Shaare-Tefila-Shofar-Sept2026-Final.pdf"],["August 2026","Shofar-August2026-Final.pdf"],["June–July 2026","Shofar-June-July2026-Final.pdf"],["May 2026","Shofar-May-2026-issue-Final.pdf"],["April 2026","Shofar-Shaare-Tefila-April-2026-for-Distribution.pdf"],["March 2026","Shofar-March-2026-Final.pdf"],["February 2026","Shofar-February2026-Final.pdf"],["January 2026","Shofar-January2026-Final.pdf"]];
document.getElementById('issues').innerHTML=issues.map(([t,f])=>`<li><a href="${F}${f}">${t}</a> <small style="display:inline">PDF</small></li>`).join('');

const ev=[];
const add=(name,time,desc,ds,link)=>ds.forEach(d=>{const[m,dd,y]=d;ev.push({name,time,desc,link,date:new Date(y,m-1,dd)})});
add('Gan Katan','9:45 am','Jewish preschool for a child and a grown-up',[[12,6,2026],[2,7,2027],[3,7,2027],[4,11,2027],[5,23,2027],[9,20,2026],[10,18,2026],[11,8,2026]],'#young');
add('Mini Minyan','6:00 pm','Welcome Shabbat for families with kids 0–7',[[10,9,2026],[11,6,2026],[12,11,2026],[2,5,2027],[3,12,2027],[5,7,2027],[6,4,2027]],'#young');
add('Tot Shabbat','11:00 am','Shabbat morning for children 0–7',[[10,24,2026],[1,23,2027],[2,20,2027],[4,24,2027],[5,22,2027]],'#young');
const today=new Date();today.setHours(0,0,0,0);
const next=ev.filter(e=>e.date>=today).sort((a,b)=>a.date-b.date).slice(0,4);
const fmt=e=>`<a class="ev" href="${e.link}" style="text-decoration:none;color:inherit"><div class="date"><small>${e.date.toLocaleDateString('en-US',{month:'short'})}</small><b>${e.date.getDate()}</b></div><div><h4>${e.name}</h4><p>${e.date.toLocaleDateString('en-US',{weekday:'long'})} · <span class="nowrap">${e.time}</span> · ${e.desc}</p></div></a>`;
const html=next.length?next.map(fmt).join(''):'<p class="muted">See the event calendar for upcoming programs.</p>';
document.getElementById('upcoming').innerHTML=html;
document.getElementById('upcoming2').innerHTML=html;
document.getElementById('upcoming3').innerHTML=html;
const photos=[["common/community-walk.jpg","Our community, all ages together"],["common/building-sukkah.jpg","Putting up the sukkah outside our building"],["common/sukkah-build.jpg","Sukkah building volunteers"],["common/religious-school-class.jpg","Chavaya Religious School"],["common/israel-flag.jpg","Students with the flag of Israel"],["common/young-crafts.jpg","Crafts with our youngest learners"],["common/kids-photo-booth.jpg","Fun at the photo booth"],["common/costume-carnival.jpg","Costumes and carnival fun"],["common/hanukkah.jpg","Celebrating Hanukkah"],["sections/gallery/hanukkah-dreidel.jpg","Dreidel time at Hanukkah"],["sections/gallery/lulav-etrog.jpg","Shaking the lulav and etrog on Sukkot"],["common/concert.jpg","Music and celebration"],["common/song-leader.jpg","Singing together"],["common/guitar-service.jpg","Music at services"],["common/rabbi-podium.jpg","Rabbi Jonah Layman"],["common/sanctuary-gathering.jpg","Gathering in the sanctuary"],["common/cooking-together.jpg","Cooking together"],["common/kitchen-volunteers.jpg","Volunteers in the kitchen"]];
const gg=document.getElementById('galGrid');
// More photos from the original website's gallery are listed in sections/gallery/photos.json
try{const r=await fetch('sections/gallery/photos.json');if(r.ok)photos.push(...await r.json());}catch(e){}
const PAGE=40;let shown=0;
const galMore=document.getElementById('galMore'),galCount=document.getElementById('galCount');
const renderMore=()=>{const next=photos.slice(shown,shown+PAGE);gg.insertAdjacentHTML('beforeend',next.map(([f,c],j)=>`<button data-i="${shown+j}" aria-label="View larger: ${c}"><img src="${f}" alt="${c}" loading="lazy"></button>`).join(''));shown+=next.length;galCount.textContent=`Showing ${shown} of ${photos.length} photos`;galMore.hidden=shown>=photos.length;};
renderMore();
galMore.addEventListener('click',()=>{const first=shown;renderMore();gg.querySelector(`[data-i="${first}"]`)?.focus();});
const lb=document.getElementById('lb'),lbImg=document.getElementById('lbImg'),lbCap=document.getElementById('lbCap');let cur=0;
const show=i=>{cur=(i+photos.length)%photos.length;const[f,c]=photos[cur];lbImg.src=f;lbImg.alt=c;lbCap.textContent=c;lb.classList.add('on');document.getElementById('lbClose').focus()};
const hide=()=>lb.classList.remove('on');
gg.addEventListener('click',e=>{const b=e.target.closest('button');if(b)show(+b.dataset.i)});
document.getElementById('lbClose').addEventListener('click',hide);
document.getElementById('lbPrev').addEventListener('click',()=>show(cur-1));
document.getElementById('lbNext').addEventListener('click',()=>show(cur+1));
lb.addEventListener('click',e=>{if(e.target===lb)hide()});
addEventListener('keydown',e=>{if(!lb.classList.contains('on'))return;if(e.key==='Escape')hide();if(e.key==='ArrowLeft')show(cur-1);if(e.key==='ArrowRight')show(cur+1)});

const views=[...document.querySelectorAll('.view')];
const links=[...document.querySelectorAll('nav.main a')];
const nav=document.getElementById('mainNav');
const btn=document.getElementById('menuBtn');
btn.addEventListener('click',()=>{const o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',o)});
function route(){
  const id=(location.hash||'#home').slice(1);
  let el=document.getElementById(id);
  let view=el&&(el.classList.contains('view')?el:el.closest('.view'));
  if(!view){view=document.getElementById('home');el=view}
  views.forEach(v=>v.classList.toggle('on',v===view));
  links.forEach(a=>{if(a.getAttribute('href')==='#'+view.id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  nav.classList.remove('open');btn.setAttribute('aria-expanded','false');
  if(el===view)window.scrollTo(0,0);else el.scrollIntoView();
  document.title=(view.id==='home'?'':view.querySelector('h1').textContent+' · ')+'Shaare Tefila Congregation';
}
addEventListener('hashchange',route);
route();
})();
