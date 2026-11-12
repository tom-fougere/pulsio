window.PulsioStorage={
  get(key,legacyKey){
    let value=localStorage.getItem(key);
    if(value!==null)return value;
    if(!legacyKey)return null;
    value=localStorage.getItem(legacyKey);
    if(value!==null){localStorage.setItem(key,value);localStorage.removeItem(legacyKey)}
    return value;
  },
  set(key,value){localStorage.setItem(key,value)}
  getHost(key){return sessionStorage.getItem(key)}
  setHost(key,value){sessionStorage.setItem(key,value)}
};
