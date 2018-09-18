const request = require('request-promise-native');

var svcRequest = function(args){
    args = args || {};
    if (!(this instanceof svcRequest)) return new svcRequest(args);
    this.service_host = args.service_host || '127.0.0.1';
    this.service_port = args.service_port || 8070;
    this.service_password = args.service_password || "WHATEVER1234567891";
    this.tx_fee = (args.tx_fee !== undefined) ? args.tx_fee : 0.1;
};

svcRequest.prototype._sendRequest = function (method, params, timeout) {
    return new Promise((resolve, reject) => {
      if (method.length === 0) return reject(new Error('Invalid Method'));
      params = params || {};
      timeout = timeout || 3000;
  
      let data = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        password: this.service_password
      };
  
      if (!data.password) delete body.password;

      let s_host = this.service_host;
      let s_port = this.service_port;
      request({
        uri: `http://${s_host}:${s_port}/json_rpc`,
        method: 'POST',
        body: data,
        json: true,
        timeout: timeout
      }).then((res) => {
        if(!res) return resolve(true);

        if (!res.error) {
            if(res.result) return resolve(res.result);
            return resolve(res);
        } else {
          return reject(res.error.message);
        }
      }).catch((err) => {
        return reject(err);
      });
    });
};

// only get single addres only, no multi address support for this wallet, yet
svcRequest.prototype.getAddress = function() {
    return new Promise((resolve, reject) => {
        this._sendRequest('getAddresses').then((result) => {
          return resolve(result.addresses[0]);
        }).catch((err) => {
          return reject(err);
        });
    });
};

svcRequest.prototype.getFeeInfo = function(){
    return new Promise((resolve, reject)=>{
        this._sendRequest('getFeeInfo').then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};

svcRequest.prototype.getBalance = function(params){
    return new Promise((resolve, reject) => {
        params = params || {}
        params.address = params.address || '';

        let req_params = {
            address: params.address
        };

        this._sendRequest('getBalance', req_params).then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};

svcRequest.prototype.getStatus = function () {
    return new Promise((resolve, reject) => {
        this._sendRequest('getStatus').then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};

svcRequest.prototype.save = function () {
    return new Promise((resolve, reject) => {
        this._sendRequest('save').then(() => {
            return resolve();
        }).catch((err) => {
            return reject(err);
        });
    });
};

svcRequest.prototype.getViewKey = function () {
    return new Promise((resolve, reject) => {
        this._sendRequest('getViewKey').then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};
  
svcRequest.prototype.getSpendKeys = function (params) {
    return new Promise((resolve, reject) => {
        params = params || {}
        params.address = params.address || '';

        if (!params.address.length) return reject(new Error('Missing address parameter'));

        var req_params = {
            address: params.address
        };

        this._sendRequest('getSpendKeys', req_params).then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};
  
svcRequest.prototype.getMnemonicSeed = function (params) {
    return new Promise((resolve, reject) => {
        params = params || {}
        params.address = params.address || ''
  
        if (params.address.length === 0) return reject(new Error('Missing address parameter'));
  
        var req_params = {
            address: params.address
        };
  
        this._sendRequest('getMnemonicSeed', req_params).then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};

svcRequest.prototype.getBackupKeys = function (params) {
    return new Promise((resolve, reject) => {
        params = params || {};
        params.address = params.address || '';

        if (params.address.length === 0) return reject(new Error('Missing address parameter'));

        var req_params = {
            address: params.address
        };

        var backupKeys = {}

        this.getViewKey().then((vkres) => {
            backupKeys.viewSecretKey = vkres.viewSecretKey;
            return vkres;
            //return Object.assign(vkres);
        }).then((vk) => {
            this.getSpendKeys(req_params).then((vsres) => {
                backupKeys.spendSecretKey = vsres.spendSecretKey;
                return vsres;
            }).catch((err) => {
                return reject(err);
            });
        }).then( (vkvs) => {
            this.getMnemonicSeed(req_params).then( (mres) => {
                backupKeys.mnemonicSeed = mres.mnemonicSeed;
                return resolve(backupKeys);
            }).catch((err) => {
                return reject(err);
            });
        }).catch( (err) => {
            return reject(err);
        });
    });
};


svcRequest.prototype.getTransactions = function (params) {
    return new Promise((resolve, reject) => {
        params = params || {};
        params.firstBlockIndex = params.firstBlockIndex || 1;
        params.blockCount = params.blockCount || 100;
  
        var req_params = {
            firstBlockIndex: (params.firstBlockIndex >= 1) ? params.firstBlockIndex : 1,
            blockCount: (params.blockCount >=1 ) ? params.blockCount : 100
        };
  
        this._sendRequest('getTransactions', req_params).then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};


// send single transaction
svcRequest.prototype.sendTransaction = function (params) {
    return new Promise((resolve, reject) => {
        params = params || {}
        params.amount = params.amount || false;
        params.address = params.address || false;
        //params.transfers = params.transfers || false;
        params.paymentId = params.paymentId || false;
        params.fee = params.fee || 0.1;
        
        if (!params.address) return reject(new Error('Missing recipient address parameter'));
        if (!params.amount) return reject(new Error('Missing transaction amount parameter'));
        if (parseFloat(params.fee) < 0.1) return reject(new Error('Minimum fee is 0.1 BTN'));
        //[{address: "BTNxxxx...", amount: 100}];
        var req_params = {
            transfers: [{address: params.address, amount: params.amount}],
            fee: params.fee
        };

        if(params.paymentId) req_params.paymentId = params.paymentId;

        // give extra long timeout
        this._sendRequest('sendTransaction', req_params, 6000).then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};

svcRequest.prototype.reset = function (params) {
    return new Promise((resolve, reject) => {
        params = params || {}
        //params.viewSecretKey = params.viewSecretKey || false;
        params.scanHeight = params.scanHeight || 0;      

        let req_params = {};
        if(params.scanHeight && params.scanHeight > 1){
            
            req_params = { scanHeight: params.scanHeight}
        }

        //if(params.viewSecretKey) req_params.viewSecretKey = params.viewSecretKey;
        this._sendRequest('reset', req_params).then(() => {
            return resolve(true);
        }).catch((err) => {
            return reject(err);
        });
    });
};


  
module.exports = svcRequest;