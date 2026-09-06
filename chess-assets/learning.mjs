import { Chess } from './chess.mjs';
export const PIECES = {
 R:{name:'Rook',tag:'Straight-line explorer',rule:'The rook moves in straight lines: up, down or sideways. It stops when another piece is in the way.'},
 B:{name:'Bishop',tag:'Diagonal dancer',rule:'The bishop slides diagonally. It stays on the same colour of square and cannot jump over pieces.'},
 Q:{name:'Queen',tag:'All-direction adventurer',rule:'The queen slides in straight lines or diagonally. She cannot jump over other pieces.'},
 N:{name:'Knight',tag:'The little jumper',rule:'The knight jumps in an L: two squares one way, then one to the side. It can jump over pieces.'},
 K:{name:'King',tag:'One small step',rule:'The king moves one square in any direction. Keep it away from squares the other team can attack.'},
 P:{name:'Pawn',tag:'Small steps, big dreams',rule:'White pawns move up the board one square. From their starting square they may move two. They capture one square diagonally forward.'}
};
const task=(from,target,pieces,prompt)=>({from,target,pieces,prompt});
export const LESSONS = [
 {id:'rook',type:'R',tasks:[task('d4','d7',{},'Take the rook straight up to the star.'),task('d4','g4',{d6:'wP'},'A friend blocks the way up. Slide sideways to the star.'),task('d4','d6',{d6:'bP'},'Capture the black pawn: land on its square with your rook.')]},
 {id:'bishop',type:'B',tasks:[task('c3','f6',{},'Follow the diagonal to the star.'),task('e3','b6',{f4:'wP'},'One diagonal is blocked. Find the open diagonal to the star.'),task('c3','f6',{f6:'bP'},'Slide diagonally to capture the black pawn.')]},
 {id:'queen',type:'Q',tasks:[task('d4','g7',{},'The queen can travel diagonally. Reach the star.'),task('d4','d7',{},'Now take the queen straight up to the star.'),task('d4','g4',{g4:'bP'},'Slide sideways to capture the black pawn.')]},
 {id:'knight',type:'N',tasks:[task('d4','f5',{},'Jump two squares right, then one up. That makes an L!'),task('d4','f5',{d5:'wP',e4:'wP',d3:'wP',c4:'wP'},'The knight can jump over its friends. Hop to the star.'),task('d4','c6',{c6:'bP'},'Jump two up, then one left to capture the black pawn.')]},
 {id:'king',type:'K',tasks:[task('d4','e5',{},'Take just one diagonal step to the star.'),task('d4','e4',{b5:'bR'},'The black rook attacks the red squares. Step safely sideways to the star.'),task('d4','c5',{c5:'bN'},'The king can capture too. Take one safe step onto the black knight.')]},
 {id:'pawn',type:'P',tasks:[task('d2','d3',{},'Take one small step forward to the star.'),task('d2','d4',{},'From its starting square, a pawn can move two squares. Try it!'),task('d4','e5',{e5:'bP'},'Pawns capture diagonally. Take the black pawn on the star.')]} 
];
export function square(r,c){return 'abcdefgh'[c]+(8-r);}
export function position(s){return {r:8-Number(s[1]),c:'abcdefgh'.indexOf(s[0])};}
export function lessonBoard(lesson,step){const t=lesson.tasks[step],b=Array.from({length:8},()=>Array(8).fill(null));for(const [sq,p] of Object.entries({...t.pieces,[t.from]:'w'+lesson.type})){const {r,c}=position(sq);b[r][c]=p;}return b;}
function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

function slide(board,r,c,dirs,color){
  var moves=[];
  for (var i=0;i<dirs.length;i++){
    var dr=dirs[i][0], dc=dirs[i][1];
    var nr=r+dr, nc=c+dc;
    while (inBounds(nr,nc)){
      var t=board[nr][nc];
      if (!t){ moves.push({r:nr,c:nc}); }
      else { if (t[0]!==color){ moves.push({r:nr,c:nc}); } break; }
      nr+=dr; nc+=dc;
    }
  }
  return moves;
}

function movementMoves(board,r,c){
  var p=board[r][c];
  if(!p) return [];
  var color=p[0], type=p[1];
  var moves=[];
  if (type==='R'){ return slide(board,r,c,[[1,0],[-1,0],[0,1],[0,-1]],color); }
  if (type==='B'){ return slide(board,r,c,[[1,1],[1,-1],[-1,1],[-1,-1]],color); }
  if (type==='Q'){ return slide(board,r,c,[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],color); }
  if (type==='N'){
    var no=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for (var i=0;i<no.length;i++){
      var nr=r+no[i][0], nc=c+no[i][1];
      if (inBounds(nr,nc) && (!board[nr][nc] || board[nr][nc][0]!==color)) moves.push({r:nr,c:nc});
    }
    return moves;
  }
  if (type==='K'){
    var ko=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (var j=0;j<ko.length;j++){
      var kr=r+ko[j][0], kc=c+ko[j][1];
      if (inBounds(kr,kc) && (!board[kr][kc] || board[kr][kc][0]!==color)) moves.push({r:kr,c:kc});
    }
    return moves;
  }
  if (type==='P'){
    var dir = (color==='w') ? -1 : 1;
    var startRow = (color==='w') ? 6 : 1;
    var oneR = r+dir;
    if (inBounds(oneR,c) && !board[oneR][c]){
      moves.push({r:oneR,c:c});
      var twoR = r+2*dir;
      if (r===startRow && inBounds(twoR,c) && !board[twoR][c]) moves.push({r:twoR,c:c});
    }
    var caps=[[dir,-1],[dir,1]];
    for (var k=0;k<caps.length;k++){
      var pr=r+caps[k][0], pc=c+caps[k][1];
      if (inBounds(pr,pc) && board[pr][pc] && board[pr][pc][0]!==color) moves.push({r:pr,c:pc});
    }
    return moves;
  }
  return moves;
}

function enemyAttacks(board,r,c){
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=board[y][x];if(!p||p[0]!=='b')continue;
  if(p[1]==='P'){if(r===y+1&&Math.abs(c-x)===1)return true;}
  else if(movementMoves(board,y,x).some(m=>m.r===r&&m.c===c))return true;
 }return false;
}
export function lessonMoves(board,from){const {r,c}=position(from),p=board[r][c];if(!p)return [];return movementMoves(board,r,c).filter(m=>{if(p[1]!=='K')return true;const b=board.map(row=>row.slice());b[m.r][m.c]=p;b[r][c]=null;return !enemyAttacks(b,m.r,m.c);}).map(m=>square(m.r,m.c));}
export function dangerSquares(board){const out=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(enemyAttacks(board,r,c))out.push(square(r,c));return out;}
export function validBadges(value){return LESSONS.filter(l=>Array.isArray(value)&&value.includes(l.id)).map(l=>l.id);}
export function earnBadge(current,id){return validBadges([...(Array.isArray(current)?current:[]),id]);}
export const pieceSrc=p=>'pieces/'+p+'.svg';
export const pieceName=p=>PIECES[p.toUpperCase()].name;
export function newPractice(){return new Chess();}
export function practiceBoard(game){return game.board().map(row=>row.map(p=>p?p.color+p.type.toUpperCase():null));}
export function legalPracticeMoves(game,from){return game.moves({square:from,verbose:true});}
const values={p:1,n:3,b:3,r:5,q:9,k:0};
export function suggestMove(game,rng=Math.random){
 const moves=game.moves({verbose:true});if(!moves.length)return null;
 let best=[],top=-Infinity;
 for(const m of moves){let score=(values[m.captured]||0)*10+(m.promotion?80:0);game.move(m);
  if(game.isCheckmate())score+=10000;
  else if(game.isAttacked(m.to,game.turn()))score-=values[m.piece]*9;
  score+=(3.5-Math.abs(3.5-'abcdefgh'.indexOf(m.to[0])))*.1;game.undo();
  if(score>top){top=score;best=[m];}else if(score===top)best.push(m);
 }return best[Math.floor(rng()*best.length)];
}
export function teddyMove(game,rng=Math.random){const moves=game.moves({verbose:true});if(!moves.length)return null;return rng()<.65?moves[Math.floor(rng()*moves.length)]:suggestMove(game,rng);}
export function gameStatus(game){const turn=game.turn()==='w'?'White':'Black';if(game.isCheckmate())return {over:true,title:'Checkmate!',text:(game.turn()==='w'?'Black':'White')+' wins. The king is in check and there is no safe move. Want to try again?'};if(game.isStalemate())return {over:true,title:'A draw — both did well!',text:turn+' has no legal move, but the king is not in check. This is called stalemate.'};if(game.isDraw())return {over:true,title:'A draw — both did well!',text:'This position is a draw. You can start another game or undo a move.'};if(game.isCheck())return {over:false,title:turn+' king needs help!',text:'Your king is in check. Move it to safety, block the attack, or capture the attacking piece.'};return {over:false,title:turn+' to move',text:'Choose one of your pieces. The dots show where it can go.'};}
export function moveExplanation(m){if(m.isKingsideCastle()||m.isQueensideCastle())return 'Castling! The king and rook move together to help protect the king.';if(m.promotion)return 'The pawn reached the other end and became a '+pieceName(m.promotion).toLowerCase()+'!';if(m.isEnPassant())return 'En passant: the pawn captures the pawn that just stepped two squares beside it.';return pieceName(m.piece)+' moved from '+m.from+' to '+m.to+(m.captured?' and captured a '+pieceName(m.captured).toLowerCase():'')+'.';}

export function hintPath(from,to,type){const a=position(from),b=position(to),points=[[a.c*100+50,a.r*100+50]];if(type.toUpperCase()==='N')points.push(Math.abs(b.c-a.c)===2?[b.c*100+50,a.r*100+50]:[a.c*100+50,b.r*100+50]);points.push([b.c*100+50,b.r*100+50]);return points.map(p=>p.join(',')).join(' ');}
