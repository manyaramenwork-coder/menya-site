
loadUsers=function(){ if(!MEM_USERS) MEM_USERS = DATA_USERS.slice(); return MEM_USERS; };
saveUsers=function(list){ MEM_USERS=list; toast('사용자 저장은 6회차에서 연결돼요.'); };
