const ink="#10233f", blue="#1a53a3", pale="#edf3fc", muted="#465b75";
const sizes=[[842,595],[1191,842],[1684,1191],[2384,1684],[3370,2384]];
const number=new Intl.NumberFormat("hu");
const score=n=>n>0?"+"+number.format(n):n<0?"−"+number.format(-n):"0";
const sum=values=>values.reduce((a,b)=>a+b,0);

function wrap(ctx,text,maxWidth) {
  const lines=[];
  for (const paragraph of String(text).split(/\r?\n/).filter(p=>p.trim())) {
    let line="";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const joined=line?line+" "+word:word;
      if(ctx.measureText(joined).width<=maxWidth){line=joined;continue;}
      if(line) lines.push(line);
      line="";
      if(ctx.measureText(word).width<=maxWidth){line=word;continue;}
      for (const char of word) {
        if(line && ctx.measureText(line+char).width>maxWidth){lines.push(line);line="";}
        line+=char;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Preserve round order while distributing whole entries across the available columns.
function balancedColumns(blocks,count) {
  if(!blocks.length)return [];
  const length=blocks.length;
  const prefix=[0];
  for(const block of blocks)prefix.push(prefix.at(-1)+block.height);
  const costs=Array.from({length:count+1},()=>Array(length+1).fill(Infinity));
  const splits=Array.from({length:count+1},()=>Array(length+1).fill(0));
  costs[0][0]=0;
  for(let c=1;c<=count;c++)for(let end=c;end<=length;end++)for(let start=c-1;start<end;start++){
    const cost=Math.max(costs[c-1][start],prefix[end]-prefix[start]);
    if(cost<costs[c][end]){costs[c][end]=cost;splits[c][end]=start;}
  }
  const columns=[];
  let end=length;
  for(let c=count;c>0;c--){const start=splits[c][end];columns.unshift(blocks.slice(start,end));end=start;}
  return columns;
}

function reportLayout(ctx, data, width, height, size, paint=false) {
  const margin=25, span=width-2*margin, bottom=height-margin, rowHeight=size*1.62;
  const font=(n,bold=false)=>ctx.font=`${bold?"700":"400"} ${n}px Arial, sans-serif`;
  const line=(text,x,y,color=ink,align="left")=>{
    if(!paint)return;
    ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline="top";ctx.fillText(text,x,y);
  };
  const rect=(x,y,w,h,color)=>{if(paint){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}};
  rect(0,0,width,height,"#ffffff");
  rect(margin,margin,span,3,blue);
  font(11,true);line("NAGY X/Y",margin,margin+10,blue);
  font(24,true);line("Végeredmény",margin,margin+25);
  font(9);line(`Szoba: ${data.code}   ·   ${new Intl.DateTimeFormat("hu",{dateStyle:"medium",timeStyle:"short"}).format(new Date(data.createdAt))}`,width-margin,margin+33,muted,"right");
  let y=margin+57;
  const widths=[.21,.1575,.1575,.1575,.1575,.16].map(r=>r*span);
  const columns=widths.map((_,i)=>margin+sum(widths.slice(0,i)));
  font(size,true);
  const headers=["Kör · szorzó",...data.names,"Kör összesen"].map((h,i)=>wrap(ctx,h,widths[i]-10));
  const headH=Math.max(...headers.map(x=>x.length))*size*1.18+8;
  rect(margin,y,span,headH,ink);
  headers.forEach((ls,i)=>ls.forEach((s,j)=>line(s,columns[i]+5,y+4+j*size*1.18,"#ffffff")));
  y+=headH;
  const played=data.rounds.filter(r=>r.scores);
  const roundsByNumber=new Map(data.rounds.map(round=>[round.number,round]));
  for(const [i,r] of played.entries()){
    font(size,true);
    const after=roundsByNumber.get(r.number+1)?.negotiations;
    const beforeFirst=r.number===1 && r.negotiations;
    const roundLabel=wrap(ctx,`${r.number}. kör · ×${r.multiplier}`,widths[0]-10);
    const negotiation=beforeFirst?wrap(ctx,`Tárgyalás az első kör előtt${beforeFirst>1?` (×${beforeFirst})`:""}`,widths[0]-10):[];
    const following=after?wrap(ctx,`Tárgyalás következik${after>1?` (×${after})`:""}`,widths[0]-10):[];
    const actualHeight=rowHeight+(roundLabel.length+negotiation.length+following.length-1)*size*1.18;
    rect(margin,y,span,actualHeight,i%2?"#ffffff":pale);
    if(beforeFirst) rect(margin,y,span,1.4,blue);
    if(after) rect(margin,y+actualHeight-1.4,span,1.4,blue);
    [...roundLabel,...negotiation,...following].forEach((label,i)=>line(label,columns[0]+5,y+size*.32+i*size*1.18,i<roundLabel.length?ink:blue));
    r.moves.forEach((v,j)=>{
      const x=columns[j+1]+5;
      font(size,true);line(v,x,y+size*.32,v==="X"?ink:blue);
      font(size);line(score(r.scores[j]),x+size*1.8,y+size*.32);
    });
    font(size,true);line(score(sum(r.scores)),columns[5]+5,y+size*.32);
    y+=actualHeight;
  }
  rect(margin,y,span,rowHeight,"#dbeaff");
  font(size,true);
  ["Összpont",...data.totals.map(score),score(sum(data.totals))].forEach((s,i)=>line(s,columns[i]+5,y+size*.32));
  y+=rowHeight+10;
  const comments=[];
  for(const r of data.rounds)r.notes.forEach((note,i)=>{
    if(note) comments.push({label:`${r.number}. kör · ${data.names[i]}${r.scores?"":" · pontozás nélkül"}`,text:note});
  });
  const reflections=data.reflections.flatMap((text,i)=>text?[{label:data.names[i],text}]:[]);
  const gap=14, leading=size*1.22, headingSize=Math.max(size+2,9);
  function section(title,entries,count){
    if(!entries.length)return true;
    const colWidth=(span-gap*(count-1))/count;
    const blocks=entries.map(({label,text})=>{
      font(size,true);const heading=wrap(ctx,label,colWidth);
      font(size);const body=wrap(ctx,text,colWidth);
      return {heading,body,height:(heading.length+body.length)*leading+size*.55};
    });
    const groups=balancedColumns(blocks,count);
    const bodyTop=y+headingSize*1.5;
    const next=bodyTop+Math.max(...groups.map(group=>sum(group.map(block=>block.height))));
    if(next>bottom)return false;
    font(headingSize,true);line(title,margin,y);
    groups.forEach((group,i)=>{
      let yy=bodyTop;
      const x=margin+i*(colWidth+gap);
      for(const block of group){
        font(size,true);for(const s of block.heading){line(s,x,yy,blue);yy+=leading;}
        font(size);for(const s of block.body){line(s,x,yy);yy+=leading;}
        yy+=size*.55;
      }
    });
    y=next+8;
    return true;
  }
  if(!comments.length && !reflections.length){
    font(size);line("Nem érkezett körjegyzet vagy reflexió.",margin,y,muted);
    return y+leading<=bottom;
  }
  const noteCols=Math.min(comments.length,comments.length<=8?2:Math.min(7,Math.max(3,Math.floor(span/235))));
  return section("Körjegyzetek",comments,noteCols) &&
    section("Csapatreflexiók",reflections,reflections.length);
}

function onePagePdf(jpeg,pixelsWide,pixelsHigh,width,height) {
  const enc=new TextEncoder(), parts=[], offsets=[0];
  let length=0;
  const add=value=>{const bytes=typeof value==="string"?enc.encode(value):value;parts.push(bytes);length+=bytes.length;};
  const object=(id,content,bytes)=>{offsets[id]=length;add(`${id} 0 obj\n${content}`);if(bytes){add(bytes);add("\nendstream");}add("\nendobj\n");};
  add("%PDF-1.4\n");
  object(1,"<< /Type /Catalog /Pages 2 0 R >>");
  object(2,"<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  object(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Report 4 0 R >> >> /Contents 5 0 R >>`);
  object(4,`<< /Type /XObject /Subtype /Image /Width ${pixelsWide} /Height ${pixelsHigh} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg);
  const commands=enc.encode(`q\n${width} 0 0 ${height} 0 0 cm\n/Report Do\nQ\n`);
  object(5,`<< /Length ${commands.length} >>\nstream\n`,commands);
  const xref=length;
  add("xref\n0 6\n0000000000 65535 f \n");
  for(const offset of offsets.slice(1))add(String(offset).padStart(10,"0")+" 00000 n \n");
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts,{type:"application/pdf"});
}

export function chooseReportLayout(ctx,data) {
  let page, size;
  for(const candidate of sizes){
    for(let n=11;n>=7.5;n-=.5)if(reportLayout(ctx,data,...candidate,n)){
      page=candidate;size=n;break;
    }
    if(page)break;
  }
  if(!page){
    page=sizes.at(-1);
    for(size=7;size>=2;size-=.25)if(reportLayout(ctx,data,...page,size))break;
    if(size<2)throw Error("A teljes jelentés egy oldalra nem helyezhető el.");
  }
  return {page,size};
}

export async function createReportPdf(data) {
  const canvas=document.createElement("canvas"), ctx=canvas.getContext("2d");
  if(!ctx)throw Error("A böngésző nem tudja előállítani a PDF-et.");
  const {page,size}=chooseReportLayout(ctx,data);
  const [w,h]=page, scale=Math.min(4,4800/w);
  canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
  ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);
  if(!reportLayout(ctx,data,w,h,size,true))throw Error("Nem sikerült a teljes jelentést az oldalra illeszteni.");
  const image=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.94));
  if(!image)throw Error("Nem sikerült a PDF képét elkészíteni.");
  return onePagePdf(new Uint8Array(await image.arrayBuffer()),canvas.width,canvas.height,w,h);
}
