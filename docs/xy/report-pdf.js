const ink="#10233f", blue="#1a53a3", pale="#edf3fc", muted="#465b75";
const sizes=[[842,595],[1191,842],[1684,1191],[2384,1684],[3370,2384]];
const number=new Intl.NumberFormat("hu");
const score=n=>n>0?"+"+number.format(n):n<0?"−"+number.format(-n):"0";
const sum=values=>values.reduce((a,b)=>a+b,0);

function wrap(ctx,text,maxWidth) {
  const lines=[];
  for (const paragraph of String(text).split(/\r?\n/)) {
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
  const widths=[.18,.165,.165,.165,.165,.16].map(r=>r*span);
  const columns=widths.map((_,i)=>margin+sum(widths.slice(0,i)));
  font(size,true);
  const headers=["Kör · szorzó",...data.names,"Kör összesen"].map((h,i)=>wrap(ctx,h,widths[i]-10));
  const headH=Math.max(...headers.map(x=>x.length))*size*1.18+8;
  rect(margin,y,span,headH,ink);
  headers.forEach((ls,i)=>ls.forEach((s,j)=>line(s,columns[i]+5,y+4+j*size*1.18,"#ffffff")));
  y+=headH;
  const played=data.rounds.filter(r=>r.scores);
  for(const [i,r] of played.entries()){
    rect(margin,y,span,rowHeight,i%2?"#ffffff":pale);
    if(r.negotiations) rect(margin,y,span,1.4,blue);
    font(size,true);line(`${r.number}. kör · ×${r.multiplier}${r.negotiations?" · T"+(r.negotiations>1?r.negotiations:""):""}`,columns[0]+5,y+size*.32);
    r.moves.forEach((v,j)=>{
      const x=columns[j+1]+5;
      font(size,true);line(v,x,y+size*.32,v==="X"?ink:blue);
      font(size);line(score(r.scores[j]),x+size*1.8,y+size*.32);
    });
    font(size,true);line(score(sum(r.scores)),columns[5]+5,y+size*.32);
    y+=rowHeight;
  }
  rect(margin,y,span,rowHeight,"#dbeaff");
  font(size,true);
  ["Összpont",...data.totals.map(score),score(sum(data.totals))].forEach((s,i)=>line(s,columns[i]+5,y+size*.32));
  y+=rowHeight+10;
  const comments=[];
  for(const r of data.rounds)r.notes.forEach((note,i)=>{
    if(note) comments.push({label:`${r.number}. kör · ${data.names[i]}${r.scores?"":" · pontozás nélkül"}`,text:note});
  });
  data.reflections.forEach((note,i)=>{if(note)comments.push({label:`Reflexió · ${data.names[i]}`,text:note});});
  font(Math.max(size+2,9),true);line("Körjegyzetek és reflexiók",margin,y);
  y+=Math.max(size+2,9)*1.45;
  const top=y, gap=12, count=width>=1600?4:3, colWidth=(span-gap*(count-1))/count, leading=size*1.19;
  let col=0;
  const advance=()=>{col++;y=top;};
  const put=(s,bold)=>{
    if(y+leading>bottom)advance();
    if(col>=count)return false;
    font(size,bold);line(s,margin+col*(colWidth+gap),y,bold?blue:ink);y+=leading;
    return true;
  };
  if(y+leading>bottom)return false;
  if(!comments.length)return put("Nem érkezett körjegyzet vagy reflexió.",false);
  for(const comment of comments){
    font(size,true);const label=wrap(ctx,comment.label,colWidth);
    font(size);const body=wrap(ctx,comment.text,colWidth);
    const blockHeight=(label.length+body.length)*leading;
    if(y>top && y+blockHeight>bottom && (blockHeight<=bottom-top || y+(label.length+1)*leading>bottom))advance();
    for(const s of label)if(!put(s,true))return false;
    for(const s of body)if(!put(s,false))return false;
    y+=size*.48;
  }
  return true;
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

export async function createReportPdf(data) {
  const canvas=document.createElement("canvas"), ctx=canvas.getContext("2d");
  if(!ctx)throw Error("A böngésző nem tudja előállítani a PDF-et.");
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
  const [w,h]=page, scale=Math.min(4,4200/w);
  canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
  ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);
  if(!reportLayout(ctx,data,w,h,size,true))throw Error("Nem sikerült a teljes jelentést az oldalra illeszteni.");
  const image=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.94));
  if(!image)throw Error("Nem sikerült a PDF képét elkészíteni.");
  return onePagePdf(new Uint8Array(await image.arrayBuffer()),canvas.width,canvas.height,w,h);
}
