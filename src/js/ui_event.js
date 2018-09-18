const {clipboard, remote, ipcRenderer, shell} = require('electron');
const fs = require('fs');
const Store = require('electron-store');
const autoComplete = require('./extras/auto-complete');
const gutils = require('./gutils');
const svcmain = require('./svc_main.js');
const settings = new Store({name: 'Settings'});
const abook = new Store({ name: 'AddressBook', encryptionKey: ['79009fb00ca1b7130832a42d','e45142cf6c4b7f33','3fe6fba5'].join('')});
const Menu = remote.Menu;

const gSession = require('./gsessions');
const wlsession = new gSession();

let win = remote.getCurrentWindow();
ipcRenderer.on('cleanup', (event, message) => {
    if(!win.isVisible()) win.show();
    if(win.isMinimized()) win.restore();

    win.focus();

    var dialog = document.getElementById('main-dialog');
    htmlText = 'Terminating Bitcoinnova-service...';
    //if(remote.getGlobal('wsession').loadedWalletAddress !== ''){
    if(wlsession.get('loadedWalletAddress') !== ''){
        var htmlText = 'Saving &amp; closing your wallet...';
    }

    let htmlStr = `<div class="div-save-main" style="text-align: center;padding:1rem;"><i class="fas fa-spinner fa-pulse"></i><span style="padding:0px 10px;">${htmlText}</span></div>`;
    dialog.innerHTML = htmlStr;
    dialog.showModal();
    try{ svcmain.stopWorker();}catch(e){}
    svcmain.stopService().then((k) => {
        setTimeout(function(){
            dialog.innerHTML = 'Good bye!';
            win.close();
        }, 1200);
    }).catch((err) => {
        win.close();
        console.log(err);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    var enterableInputs = document.querySelectorAll('.section input');
    Array.from(enterableInputs).forEach( (el) => {
        el.addEventListener('keyup', (e) => {
            if(e.key === 'Enter'){
                let section = el.closest('.section');
                let target = section.querySelector('button:not(.path-input-button)');
                if(target) target.click();
            }
        });
    });

    const pasteMenu = Menu.buildFromTemplate([
        { label: 'Paste', role: 'paste'}
    ]);
    
    let editableInputs = document.querySelectorAll('textarea:not([readonly]), input:not([readonly]');
    Array.from(editableInputs).forEach( (el) => {
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            pasteMenu.popup(remote.getCurrentWindow());
        }, false);
    });
}, false);

window.addEventListener('resize', (event) => {
    let tw = document.querySelector('.transaction-table-wrapper');
    tw.style.maxHeight = `${(window.innerHeight - 260)}px`
});

/* section switcher */
var TXLIST = null;
function changeSection (sectionId) {
    // hide the current section that is being shown
    const sections = document.querySelectorAll('.is-shown');
    let section = document.getElementById(sectionId);
    Array.prototype.forEach.call(sections, function (section) {
        section.classList.remove('is-shown');
    });

    section.classList.add('is-shown');
    const btn = document.querySelector(`.btn-active`);
    if(btn) btn.classList.remove('btn-active');
    if(sectionId.trim() === 'section-welcome') sectionId = 'section-overview';
    let activeBtn = document.querySelector(`.navbar button[data-section="${sectionId}"]`);
    if(activeBtn) activeBtn.classList.add('btn-active');
}

function showToast(msg, duration){
    duration = duration || 1800;
    if(!document.getElementById('datoaste')){
        iqwerty.toast.Toast(msg, {settings: {duration:duration}});
    }
}

var NODES_COMPLETION;
var ADDR_COMPLETION;
/* basic listeners */
function initBaseEvent(){
    /** ------------------ BEGIN General  ------------------------------------ */
    //external link
    gutils.liveEvent('a.external', 'click', (event) => {
        event.preventDefault();
        shell.openExternal(event.target.getAttribute('href'));
        return false;
    });
    
    // inject section dom
    const links = document.querySelectorAll('link[rel="import"]');
    Array.prototype.forEach.call(links, function (link) {
        let template = link.import.getElementsByTagName("template")[0];
        let clone = document.importNode(template.content, true);
        document.querySelector('#main-div').appendChild(clone);
    });
    // call to section switcher
    const sectionButtons = document.querySelectorAll('[data-section]');
    Array.prototype.forEach.call(sectionButtons, function (button) {
        button.addEventListener('click', function(event) {
            let targetSection = button.getAttribute('data-section');
            let syncText = document.getElementById('navbar-text-sync').textContent.trim();
            if( ( targetSection === 'section-transactions'
                  || targetSection === 'section-send'
                  || targetSection === 'section-overview')
                  && !wlsession.get('serviceReady')
            ){
                changeSection('section-welcome');
                showToast("Please create/open your wallet!");
            }else if(targetSection === 'section-welcome' && wlsession.get('serviceReady') ){
                // the opposite
                changeSection('section-overview');
            }else if(targetSection === 'section-send' && syncText !== 'SYNCED'){
                showToast("Please wait until syncing process completed!");
                return;
            }else{
                if(button.getAttribute('id')) svcmain.onSectionChanged(button.getAttribute('id'));
                initNodeCompletion();
                changeSection(targetSection);
            }
        });
    });

    // click to copy
    gutils.liveEvent('textarea.ctcl, input.ctcl', 'click', (event) => {
        let el = event.target;
        wv = el.value ? el.value.trim() : '';
        el.select();
        if(!wv.length) return;
        clipboard.writeText(wv);
        showToast('Copied to clipboard!');
    });

    gutils.liveEvent('.tctcl', 'click', (event) => {
        let el = event.target;
        wv = el.textContent.trim();
        gutils.selectText(el);
        if(!wv.length) return;
        clipboard.writeText(wv);
        showToast('Copied to clipboard!');
    });

    let walletAddressInput = document.getElementById('wallet-address');
    walletAddressInput.addEventListener('click', function(event){
        if(!this.value) return;
        let wv = this.value;
        let clipInfo = document.getElementById('form-help-wallet-address');
        let origInfo = clipInfo.textContent;
        if(wv.length >= 10){
            this.select();
            clipboard.writeText(wv.trim());
            clipInfo.textContent = "Address copied to clipboard!";
            clipInfo.classList.add('help-hl');
            setTimeout(function(){
                clipInfo.textContent = origInfo;
                clipInfo.classList.remove('help-hl');
            }, 1800);
        }
    });
    

    // Default page: settings page for app first run, else the overview tab
    if(!settings.has('firstRun') || settings.get('firstRun') !== 0){
        changeSection('section-settings');
        settings.set('firstRun', 0);
    }else{
        changeSection('section-welcome');
    }

    // generic browse path btn event
    const browseBtn = document.getElementsByClassName('path-input-button');
    Array.from(browseBtn).forEach((el) => {
        el.addEventListener('click', function(){
            var targetinput = document.getElementById(this.dataset.targetinput);
            var targetprop =  this.dataset.selection;
            remote.dialog.showOpenDialog({properties: [targetprop]}, function (files) {
                if (files) targetinput.value = files[0];
            });
        });
    });

    gutils.liveEvent('.dialog-close-default','click', (event) =>{
        let el = event.target;
        if(el.dataset.target){
            tel = document.querySelector(el.dataset.target);
            tel.close();
        }
    });
    /** ------------------ END General  ------------------------------------ */

    /** ------------------ BEGIN generic success/error/warning form  */
    const formMsgEl = document.getElementsByClassName('form-ew');
    function formStatusClear(){
        if(!formMsgEl.length) return;
        Array.from(formMsgEl).forEach((el) => {
            el.classList.add('hidden');
            gutils.clearChild(el);
        });
    }

    formStatusClear();

    function formStatusMsg(target, status, txt){
        // clear all msg
        formStatusClear();
        let the_target = `${target}-${status}`;
        let the_el = null;
        try{ 
            the_el = document.querySelector('.form-ew[id$="'+the_target+'"]');
        }catch(e){}
        
        if(the_el){
            the_el.classList.remove('hidden');
            gutils.innerHTML(the_el, txt);
        }
    }
    /** ------------------ END generic success/error/warning form -- */


    /** ------------------ BEGIN settings ------------------------- */
    const settingsServiceBinField = document.getElementById('input-settings-path');
    const settingsDaemonHostField = document.getElementById('input-settings-daemon-address');
    const settingsDaemonPortField = document.getElementById('input-settings-daemon-port');
    const settingsMinToTrayField = document.getElementById('checkbox-tray-minimize');
    const settingsCloseToTrayField = document.getElementById('checkbox-tray-close');

    const settingsSaveButton = document.getElementById('button-settings-save');
    function initSettingVal(values){
        values = values || null;
        if(values){
            // save new settings
            settings.set('service_bin', values.service_bin);
            settings.set('daemon_host', values.daemon_host);
            settings.set('daemon_port', values.daemon_port);
            settings.set('tray_minimize', values.tray_minimize);
            settings.set('tray_close', values.tray_close);
        }
        settingsServiceBinField.value = settings.get('service_bin');
        settingsDaemonHostField.value = settings.get('daemon_host');
        settingsDaemonPortField.value = settings.get('daemon_port');
        settingsMinToTrayField.checked = settings.get('tray_minimize');
        settingsCloseToTrayField.checked = settings.get('tray_close');

        // if custom node, save it
        let mynode = `${settings.get('daemon_host')}:${settings.get('daemon_port')}`;
        let pnodes = settings.get('pubnodes_data');
        if(!settings.has('pubnodes_custom')) settings.set('pubnodes_custom', new Array());
        let cnodes = settings.get('pubnodes_custom');
        if(pnodes.indexOf(mynode) === -1 && cnodes.indexOf(mynode) === -1){
            cnodes.push(mynode);
            settings.set('pubnodes_custom', cnodes);
        }
    }
    
    function initNodeCompletion(){
        if(!settings.has('pubnodes_data')) return;
        try{
            if(NODES_COMPLETION) NODES_COMPLETION.destroy();
        }catch(e){}

        let publicNodes = settings.has('pubnodes_custom') ? gutils.arrShuffle(settings.get('pubnodes_data')) : [];
        let nodeChoices = settings.get('pubnodes_custom').concat(publicNodes);

        NODES_COMPLETION = new autoComplete({
            selector: 'input[name="nodeAddress"]',
            minChars: 0,
            source: function(term, suggest){
                term = term.toLowerCase();
                var choices = nodeChoices;
                var matches = [];
                for (i=0; i<choices.length; i++)
                    if (~choices[i].toLowerCase().indexOf(term)) matches.push(choices[i]);
                suggest(matches);
            },
            onSelect: function(e, term, item){
                document.getElementById('input-settings-daemon-address').value = term.split(':')[0];
                document.getElementById('input-settings-daemon-port').value = term.split(':')[1];
            }
        });
    }

    function initAddressCompletion(){
        var nodeAddress = [];

        Object.keys(abook.get()).forEach((key) => {
            let et = abook.get(key);
            nodeAddress.push(`${et.name}###${et.address}###${(et.paymentId ? et.paymentId : '')}`);
        });

        try{
            if(ADDR_COMPLETION) ADDR_COMPLETION.destroy();
        }catch(e){
            console.log(e);
        }

        ADDR_COMPLETION = new autoComplete({
            selector: 'input[id="input-send-address"]',
            minChars: 1,
            source: function(term, suggest){
                term = term.toLowerCase();
                var choices = nodeAddress;
                var matches = [];
                for (i=0; i<choices.length; i++)
                    if (~choices[i].toLowerCase().indexOf(term)) matches.push(choices[i]);
                suggest(matches);
            },
            renderItem: function(item, search){
                search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                var re = new RegExp("(" + search.split(' ').join('|') + ")", "gi");
                var spl = item.split("###");
                var wname = spl[0];
                var waddr = spl[1];
                var wpayid = spl[2];
                return `<div class="autocomplete-suggestion" data-paymentid="${wpayid}" data-val="${waddr}">${wname.replace(re, "<b>$1</b>")}<br><span class="autocomplete-wallet-addr">${waddr.replace(re, "<b>$1</b>")}<br>Payment ID: ${(wpayid ? wpayid.replace(re, "<b>$1</b>") : 'N/A')}</span></div>`;
            },
            onSelect: function(e, term, item){               
                document.getElementById('input-send-payid').value = item.getAttribute('data-paymentid');
            }
        });
    }

    initSettingVal();
    initNodeCompletion();
    initAddressCompletion();

    settingsSaveButton.addEventListener('click', function(){
        formStatusClear();

        if(!settingsServiceBinField.value 
            || !settingsDaemonHostField.value
            || !settingsDaemonPortField.value
        ) {
            formStatusMsg('settings','error',"Settings can't be saved, please check your input");
            return false;
        }
        let vals = {
            service_bin: settingsServiceBinField.value.trim(),
            daemon_host: settingsDaemonHostField.value.trim(),
            daemon_port: settingsDaemonPortField.value.trim(),
            tray_minimize: settingsMinToTrayField.checked,
            tray_close: settingsCloseToTrayField.checked
        }
        initSettingVal(vals);
        formStatusMsg('settings','success', "Settings has been updated.");
    });
    /** ------------------ END settings ------------------------- */

    /** ------------------ BEGIN address book ------------------- */
    function insertSampleAddresses(){
        let flag = 'addressBookFirstUse';
        
        if(!settings.get(flag, true)) return;

        const sampleData = [
            { name: 'Nicolas_Ala',
              address: 'E4wMc2iPEtWbiPZfqFLeCqY1BLZCDb8oagiJL27JWPLhHoCvg6YJhVpaLtKAKKKvLnPg9Y4XAeeYBApBz2zZ3dQNEtuvgYh',
              paymentId: '', 
            },
            { name: 'David',
              address: 'E5MJiTWo3cNehswKbj5zmoNfwr2JVidMf3bpCswzWeJQ7g3m3Bjvb8dAvs1RXq3F6dfW1UFTNQ3yULqeQbbgJ8GY1yUHPKC',
              paymentId: '', 
            },
            { name: 'Donations',
              address: 'EAsX15ieXY1NAk9Yu3NoVBfBqUgsFPsv47Ff4W1t491vHiD8fyGHD7nR7gVk1FrcbP2d2mJfBt3M45NgbV6ZRcSdHixcSPH',
              paymentId: '', 
            }
        ];

        sampleData.forEach((item) => {
            let ahash = gutils.b2sSum(item.address + item.paymentId);
            let aqr = gutils.genQrDataUrl(item.address);
            item.qrCode = aqr;
            abook.set(ahash, item);
        });
        settings.set(flag, false);
    }
    // insert sample address :)
    insertSampleAddresses();
    // abook fields & buttons
    const addressBookNameField = document.getElementById('input-addressbook-name');
    const addressBookWalletField = document.getElementById('input-addressbook-wallet');
    const addressBookPaymentIdField = document.getElementById('input-addressbook-paymentid');
    const addressBookUpdateField = document.getElementById('input-addressbook-update');
    const addressBookSaveButton = document.getElementById('button-addressbook-save');
    addressBookSaveButton.addEventListener('click', (event) => {
        formStatusClear();
        let nameValue = addressBookNameField.value ? addressBookNameField.value.trim() : '';
        let walletValue = addressBookWalletField.value ? addressBookWalletField.value.trim() : '';
        let paymentIdValue = addressBookPaymentIdField.value ? addressBookPaymentIdField.value.trim() : '';
        let isUpdate = addressBookUpdateField.value ? addressBookUpdateField.value : 0;

        if( !nameValue || !walletValue ){
            formStatusMsg('addressbook','error',"Name and wallet address can not be left empty!");
            return;
        }

        if(!gutils.validateBTNAddress(walletValue)){
            formStatusMsg('addressbook','error',"Invalid Bitcoin nova address");
            return;
        }
        
        if( paymentIdValue.length){
            if( !gutils.validatePaymentId(paymentIdValue) ){
                formStatusMsg('addressbook','error',"Invalid Payment ID");
                return;
            }
        }

        let entryName = nameValue.trim();
        let entryAddr = walletValue.trim();
        let entryPaymentId = paymentIdValue.trim();
        let entryHash = gutils.b2sSum(entryAddr + entryPaymentId);

        if(abook.has(entryHash) && !isUpdate){
            formStatusMsg('addressbook','error',"This combination of address and payment ID already exist, please enter new address or different payment id.");
            return;
        }
   
        try{
            abook.set(entryHash, {
                name: entryName,
                address: entryAddr,
                paymentId: entryPaymentId,
                qrCode: gutils.genQrDataUrl(entryAddr)
            });
        }catch(e){
            formStatusMsg('addressbook','error',"Address book entry can not be saved, please try again");
            return;
        }
        addressBookNameField.value = '';
        addressBookWalletField.value = '';
        addressBookPaymentIdField.value = '';
        addressBookUpdateField.value = 0;
        initAddressCompletion();
        formStatusMsg('addressbook','success', 'Address book entry has been saved.');
    });
    /** ------------------ END address book ------------------- */

    /** ------------------ BEGIN OPEN WALLET --------------------- */
    const openWalletPathField = document.getElementById('input-load-path');
    const openWalletPasswordField = document.getElementById('input-load-password');
    const openWalletButton = document.getElementById('button-load-load');
    
    function initOpenWallet(){
        if(settings.has('recentWallet')){
            openWalletPathField.value = settings.get('recentWallet');
        }
    }

    initOpenWallet();
    openWalletButton.addEventListener('click', (event) => {
        formStatusClear();
        if(!openWalletPathField.value){
            formStatusMsg('load','error', "Invalid wallet file path");
            return;
        }

        function onError(err){
            formStatusClear();
            formStatusMsg('load','error', err);
            return false;
        }

        function onSuccess(theWallet, scanHeight){
            formStatusClear();
            document.getElementById('wallet-address').value = wlsession.get('loadedWalletAddress');
            document.getElementById('button-section-overview').click();
            let thefee = svcmain.getNodeFee();
        }

        let walletFile = openWalletPathField.value;
        let walletPass = openWalletPasswordField.value;
        let scanHeight = 0;
        fs.access(walletFile, fs.constants.R_OK, (err) => {
            if(err){
                formStatusMsg('load','error', "Invalid wallet file path");
                return false;
            }

            settings.set('recentWallet', walletFile);
            
            formStatusMsg('load','warning', "Starting wallet service...");
            svcmain.stopService(true).then((v) => {
                setTimeout(() => {
                    formStatusMsg('load','warning', "Opening wallet, please be patient...");
                    svcmain.startService(walletFile, walletPass, scanHeight, onError, onSuccess);
                },1200);
            }).catch((err) => {
                console.log(err);
                formStatusMsg('load','error', "Unable to start service");
                return false;
            });
        });
    });

    document.getElementById('button-overview-closewallet').addEventListener('click', (event) => {
        event.preventDefault();
        if(!confirm('Are you sure want to close your wallet?')) return;

        let dialog = document.getElementById('main-dialog');
        let htmlStr = '<div class="div-save-main" style="text-align: center;padding:1rem;"><i class="fas fa-spinner fa-pulse"></i><span style="padding:0px 10px;">Saving &amp; closing your wallet...</span></div>';
        gutils.innerHTML(dialog, htmlStr);

        dialog = document.getElementById('main-dialog');
        dialog.showModal();
        // save + SIGTERMed wallet daemon
        svcmain.stopWorker();
        svcmain.stopService(true).then((k) => {
            setTimeout(function(){
                // cleare form err msg
                formStatusClear();
                document.getElementById('button-section-overview').click();
                // clear tx
                document.getElementById('button-transactions-refresh').click();
                // send fake blockUpdated event
                let resetdata = {
                    type: 'blockUpdated',
                    data: {
                        blockCount: -100,
                        displayBlockCount: -100,
                        knownBlockCount: -100,
                        displayKnownBlockCount: -100,
                        syncPercent: -100
                    }
                };
                svcmain.handleWorkerUpdate(resetdata);
                dialog = document.getElementById('main-dialog');
                if(dialog.hasAttribute('open')) dialog.close();
                gutils.clearChild(dialog);
            }, 1200);
        }).catch((err) => {
            console.log(err);
        });
    });
    /** ------------------ END OPEN WALLET ----------------------- */

    /** ------------------ BEGIN SHOWKEYS ------------------------ */
    // reveal button
    const showKeyButton = document.getElementById('button-show-reveal');
    const exportKeyButton = document.getElementById('button-show-export');
    const showKeyViewKeyField = document.getElementById('key-show-view');
    const showKeySpendKeyField = document.getElementById('key-show-spend');
    const showKeySeedField = document.getElementById('seed-show');
    const addressField = document.getElementById('wallet-address');
    
    showKeyButton.addEventListener('click', (event) => {
        formStatusClear();
        if(!addressField.value) return;
        svcmain.getSecretKeys(addressField.value).then((keys) => {
            showKeyViewKeyField.value = keys.viewSecretKey;
            showKeySpendKeyField.value = keys.spendSecretKey;
            showKeySeedField.value = keys.mnemonicSeed;
        }).catch((err) => {
            formStatusMsg('secret','error', "Failed to get key, please try again in a few seconds");
        });
    });

    exportKeyButton.addEventListener('click', (event) => {
        formStatusClear();
        let filename = remote.dialog.showSaveDialog({
            title: "Export keys to file...",
            filters: [
                { name: 'Text files', extensions: ['txt'] }
              ]
        });
        if(filename){
            svcmain.getSecretKeys(addressField.value).then((keys) => {
                let textContent = `View Secret Key:
${keys.viewSecretKey}

Spend Secret Key:
${keys.spendSecretKey}

Mnemonic Seed: 
${keys.mnemonicSeed}`;
                try{
                    fs.writeFileSync(filename, textContent);
                    formStatusMsg('secret','success', 'Your keys has been exported, please keep the file secret to you!');
                }catch(err){
                    formStatusMsg('secret','error', "Failed to save your keys, please check that you have write permission to the file");
                }
            }).catch((err) => {
                formStatusMsg('secret','error', "Failed to get key, please try again in a few seconds");
            });
        }
    });
    /** ------------------ END SHOWKEYS ------------------------ */

    /** ------------------ BEGIN SEND -------------------------- */
    const sendAddress = document.getElementById('input-send-address');
    const sendAmount = document.getElementById('input-send-amount');
    const sendPayID = document.getElementById('input-send-payid');
    const sendFee = document.getElementById('input-send-fee');
    sendFee.value = 0.1;
    const sendButton = document.getElementById('button-send-send');

    sendButton.addEventListener('click', (event) => {
        formStatusClear();

        function precision(a) {
            if (!isFinite(a)) return 0;
            let e = 1, p = 0;
            while (Math.round(a * e) / e !== a) { e *= 10; p++; }
            return p;
        }

        let recAddress = sendAddress.value ? sendAddress.value.trim() : '';
        let recPayId = sendPayID.value ? sendPayID.value.trim() : '';
        let amount = sendAmount.value ?  parseFloat(sendAmount.value) : 0;
        let fee = parseFloat(sendFee.value);

        if(!recAddress.length || !gutils.validateBTNAddress(recAddress)){
            formStatusMsg('send','error','Sorry, invalid BTN address');
            return;
        }

        if(recAddress === wlsession.get('loadedWalletAddress')){
            formStatusMsg('send','error',"Sorry, can't send to your own address");
            return;
        }

        if(recPayId.length){
            if(!gutils.validatePaymentId(recPayId)){
                formStatusMsg('send','error','Sorry, invalid Payment ID');
                return;
            }
        }
        
        if (isNaN(amount) || amount <= 0) {
            formStatusMsg('send','error','Sorry, invalid amount');
            return;
        }

        if (precision(amount) > 2) {
            formStatusMsg('send','error',"Amount can't have more than 2 decimal places");
            return;
        }
        amount *= 100;

        if (isNaN(fee) || fee < 0.10) {
            formStatusMsg('send','error','Invalid fee amount!');
            return;
        }

        if (precision(fee) > 2) {
            formStatusMsg('send','error',"Fee can't have more than 2 decimal places");
            return;
        }
        fee *= 100;

        let tx = {
            address: recAddress,
            fee: fee,
            amount: amount
        }

        if(recPayId.length) tx.paymentId = recPayId;

        let nodeFee = wlsession.get('nodeFee') || 0;
        let tpl = `
            <div class="div-transaction-panel">
                <h4>Transfer Confirmation</h4>
                <div class="transferDetail">
                    <p>Please confirm that you have everything entered correctly.</p>
                    <dl>
                        <dt>Recipient address:</dt>
                        <dd>${tx.address}</dd>
                        <dt>Payment ID:</dt>
                        <dd>${recPayId.length ? recPayId : 'N/A'}</dd>
                        <dt class="dt-ib">Amount:</dt>
                        <dd class="dd-ib">${parseFloat(sendAmount.value).toFixed(2)} BTN</dd>
                        <dt class="dt-ib">Transaction Fee:</dt>
                        <dd class="dd-ib">${(fee/100).toFixed(2)} BTN</dd>
                        <dt class="dt-ib">Node Fee:</dt>
                        <dd class="dd-ib">${(nodeFee > 0 ? (nodeFee/100).toFixed(2) : '0.00')} BTN</dd>
                    </dl>
                </div>
            </div>
            <div class="div-panel-buttons">
                <button data-target='#tf-dialog' type="button" class="form-bt button-red dialog-close-default" id="button-send-ko">Cancel</button>
                <button data-target='#tf-dialog' type="button" class="form-bt button-green" id="button-send-ok">OK, Send it!</button>
            </div>`;

        let dialog = document.getElementById('tf-dialog');
        gutils.innerHTML(dialog, tpl);
        dialog = document.getElementById('tf-dialog');
        dialog.showModal();

        let sendBtn = dialog.querySelector('#button-send-ok');
        sendBtn.addEventListener('click', (event) => {
            let md = document.querySelector(event.target.dataset.target);
            md.close();
            formStatusMsg('send', 'warning', 'Sending transaction, please wait...');
            svcmain.sendTransaction(tx).then((result) => {
                formStatusClear();
                let okMsg = `Transaction sent!<br>Tx. hash: ${result.transactionHash}.<br>Your balance may appear incorrect while transaction not fully confirmed.`
                formStatusMsg('send', 'success', okMsg);
                // check if it's new address, if so save it
                let newId = gutils.b2sSum(recAddress + recPayId);
                if(!abook.has(newId)){
                    let now = new Date().toISOString();
                    let newName = `unnamed (${now.split('T')[0].replace(/-/g,'')}_${now.split('T')[1].split('.')[0].replace(/:/g,'')})`;
                    let newBuddy = {
                        name: newName,
                        address: recAddress,
                        paymentId: recPayId,
                        qrCode: gutils.genQrDataUrl(recAddress)
                    };
                    abook.set(newId,newBuddy);
                }
                sendAddress.value = '';
                sendPayID.value = '';
                sendAmount.value = '';
            }).catch((err) => {
                formStatusClear();
                formStatusMsg('send','error','Failed to send transaction, check that you have enough balance to transfer and paying fees<br>Error code: <small>' + err) + '</small>';
            });
            gutils.clearChild(md);
            
        });
    });
    /** ------------------ END SEND ---------------------------- */

    /** ------------------ BEGIN NEW WALLET -------------------- */
    const createButton = document.getElementById('button-create-create');
    const createPathField = document.getElementById('input-create-path');
    const createFileField = document.getElementById('input-create-name');
    const createPasswordField = document.getElementById('input-create-password');
    createButton.addEventListener('click', (event) => {
        formStatusClear();
        if(!createPathField.value || !createFileField.value){
            formStatusMsg('create', 'error', 'Please check your path input');
            return;
        }

        svcmain.createWallet(
            createPathField.value,
            createFileField.value,
            createPasswordField.value
        ).then((walletFile) => {
            settings.set('recentWallet', walletFile);
            settings.set('recentWalletDir', createPathField.value);
            document.getElementById('input-load-path').value = walletFile;
            document.getElementById('button-welcome-openwallet').click();
            showToast('Wallet has been created, you can now open your wallet!',8000);
        }).catch((err) => {
            formStatusMsg('create', 'error', err);
            return;
        });
    });

    /** ------------------ END NEW WALLET ---------------------- */

    /** ------------------ BEGIN IMPORT KEY -------------------- */
    const importKeyButton = document.getElementById('button-import-import');
    const importKeyPathField = document.getElementById('input-import-path');
    const importKeyFileField = document.getElementById('input-import-name');
    const importKeyPasswordField = document.getElementById('input-import-password');
    const importKeyViewKeyField = document.getElementById('key-import-view');
    const importKeySpendKeyField = document.getElementById('key-import-spend');
    const importKeyScanHeightField = document.getElementById('key-import-height');

    importKeyButton.addEventListener('click', (event) => {
        formStatusClear();
        svcmain.importFromKey(
            importKeyPathField.value,
            importKeyFileField.value,
            importKeyPasswordField.value,
            importKeyViewKeyField.value,
            importKeySpendKeyField.value,
            importKeyScanHeightField.value
        ).then((walletFile) => {
            settings.set('recentWallet', walletFile);
            settings.set('recentWalletDir', importKeyPathField.value);
            document.getElementById('input-load-path').value = walletFile;
            document.getElementById('button-welcome-openwallet').click();
            showToast('Wallet has been imported, you can now open your wallet!', 8000);
        }).catch((err) => {
            formStatusMsg('import', 'error',err);
            return;
        });
    });

    /** ------------------ END IMPORT KEY -----------------------*/

    /** ------------------ BEGIN IMPORT SEED ------------------- */
    const importSeedButton = document.getElementById('button-import-seed-import');
    //const textSuccess = document.getElementById('text-import-seed-success');
    //const textError = document.getElementById('text-import-seed-error');
    const importSeedPathField = document.getElementById('input-import-seed-path');
    const importSeedFileField = document.getElementById('input-import-seed-name');
    const importSeedPasswordField = document.getElementById('input-import-seed-password');
    const importSeedMnemonicField = document.getElementById('key-import-seed');
    const importSeedScanHeightField = document.getElementById('key-import-seed-height');
    importSeedButton.addEventListener('click', (event) => {
        formStatusClear();
        svcmain.importFromSeed(
            importSeedPathField.value,
            importSeedFileField.value,
            importSeedPasswordField.value,
            importSeedMnemonicField.value,
            importSeedScanHeightField.value
        ).then((walletFile) => {
            settings.set('recentWallet', walletFile);
            settings.set('recentWalletDir', importSeedPathField.value);
            document.getElementById('input-load-path').value = walletFile;
            document.getElementById('button-welcome-openwallet').click();
            showToast('Wallet has been imported, you can now open your wallet!', 8000);
        }).catch((err) => {
            formStatusMsg('import-seed', 'error',err);
            return;
        });
    });
    /** ------------------ END IMPORT SEED --------------------- */

    /** ------------------ BEGIN Transaction ------------------- */
    const refreshButton = document.getElementById('button-transactions-refresh');
    let txSortAmountButton = document.getElementById('txSortAmount');
    let txSortTimeButton = document.getElementById('txSortTime');  
    let txListOpts = {
        valueNames: [
            { data: [
                'rawPaymentId', 'rawHash', 'txType', 'rawAmount', 'rawFee',
                'fee', 'timestamp', 'blockIndex', 'extra', 'isBase', 'unlockTime'
            ]},
            'amount','timeStr','paymentId','transactionHash','fee'
        ],
        item: `<tr title="click for detail..." class="txlist-item">
                <td class="txinfo">
                    <p class="timeStr tx-date"></p>
                    <p class="tx-ov-info">Tx. Hash: <span class="transactionHash"></span></p>
                    <p class="tx-ov-info">Payment ID: <span class="paymentId"></span></p>
                </td><td class="amount txamount"></td>
        </tr>`,
        searchColumns: ['transactionHash','paymentId','timeStr','amount'],
        indexAsync: true
    };

    gutils.liveEvent('.txlist-item', 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        return showTransaction(event.target);
    },document.getElementById('transaction-lists'));

    function showTransaction(el){
        let tx = (el.name === "tr" ? el : el.closest('tr'));
        let txdate = new Date(tx.dataset.timestamp*1000).toUTCString();
        let dialogTpl = `
                <div class="div-transactions-panel">
                    <h4>Transaction Detail</h4>
                    <table class="custom-table" id="transactions-panel-table">
                        <tbody>
                            <tr><th scope="col">Hash</th>
                                <td>${tx.dataset.rawhash}</td></tr>
                            <tr><th scope="col">Address</th>
                                <td>${wlsession.get('loadedWalletAddress')}</td></tr>
                            <tr><th scope="col">Amount</th>
                                <td>${tx.dataset.rawamount}</td></tr>
                            <tr><th scope="col">Fee</th>
                                <td>${tx.dataset.rawfee}</td></tr>
                            <tr><th scope="col">Timestamp</th>
                                <td>${tx.dataset.timestamp} (${txdate})</td></tr>
                            <tr><th scope="col">Payment Id</th>
                                <td>${tx.dataset.rawpaymentid}</td></tr>
                            <tr><th scope="col">Block Index</th>
                                <td>${tx.dataset.blockindex}</td></tr>
                            <tr><th scope="col">Is Base?</th>
                                <td>${tx.dataset.isbase}</td></tr>
                            <tr><th scope="col">Unlock Time</th>
                                <td>${tx.dataset.unlocktime}</td></tr>
                            <tr><th scope="col">Extra</th>
                                <td>${tx.dataset.extra}</td></tr>
                        </tbody>
                    </table> 
                </div>
                <div class="div-panel-buttons">
                    <button data-target="#tx-dialog" type="button" class="form-bt button-red dialog-close-default" id="button-transactions-panel-close">Close</button>
                </div>
            `;

        let dialog = document.getElementById('tx-dialog');
        gutils.innerHTML(dialog, dialogTpl);
        dialog = document.getElementById('tx-dialog');
        dialog.showModal();
    }

    function sortAmount(a, b){
        var aVal = parseFloat(a._values.amount.replace(/[^0-9.-]/g, ""));
        var bVal = parseFloat(b._values.amount.replace(/[^0-9.-]/g, ""));
        if (aVal > bVal) return 1;
        if (aVal < bVal) return -1;
        return 0;
    }

    function resetTxSortMark(){
        let sortedEl = document.querySelectorAll('#transaction-lists .asc, #transaction-lists .desc');
        Array.from(sortedEl).forEach((el)=>{
            el.classList.remove('asc');
            el.classList.remove('desc');
        });
    }

    function setTxFiller(show){
        show = show || false;
        
        let fillerRow = document.getElementById('txfiller');
        if(!show && fillerRow){
            fillerRow.remove();
            return;
        }

        let hasItemRow = document.querySelector('#transaction-list-table > tbody > tr.txlist-item');
        if(!fillerRow && !hasItemRow){
            let tx = document.querySelector('#transaction-list-table > tbody');
            let tpl = `<tr id="txfiller"><td colspan="2" class="text-center">No transactions found, yet -:(.</td></tr>`;
            gutils.innerHTML(tx, tpl);
        }
    }

    function listTransactions(){
        if(wlsession.get('txLen') <= 0){
            setTxFiller(true);
            return;
        }

        let txs = wlsession.get('txNew');
        if(!txs.length) {
            setTxFiller(true);
            return;
        }

        let txsPerPage = 20;
        if(TXLIST === null){
            setTxFiller();
            if(txs.length > txsPerPage){
                txListOpts.page = txsPerPage;
                txListOpts.pagination = [{
                    innerWindow: 2,
                    outerWindow: 1
                }]; 
            }
            TXLIST = new List('transaction-lists', txListOpts, txs);
            TXLIST.sort('timestamp', {order: 'desc'});
            resetTxSortMark();
            txSortTimeButton.classList.add('desc');
            txSortTimeButton.dataset.dir = 'desc';
        }else{
            setTxFiller();
            TXLIST.add(txs);
            TXLIST.sort('timestamp', {order: 'desc'});
            resetTxSortMark();
            txSortTimeButton.classList.add('desc');
            txSortTimeButton.dataset.dir = 'desc';
            //showToast(`Transaction list updated`);
        }
    }
 
    txSortAmountButton.addEventListener('click',(event)=>{
        event.preventDefault();
        let currentDir = event.target.dataset.dir;
        let targetDir = (currentDir === 'desc' ? 'asc' : 'desc');
        event.target.dataset.dir = targetDir;
        resetTxSortMark();
        event.target.classList.add(targetDir);
        TXLIST.sort('amount', {
            order: targetDir,
            sortFunction: sortAmount
        });
    });

    txSortTimeButton.addEventListener('click',(event)=>{
        event.preventDefault();
        let currentDir = event.target.dataset.dir;
        let targetDir = (currentDir === 'desc' ? 'asc' : 'desc');
        event.target.dataset.dir = targetDir;
        resetTxSortMark();
        event.target.classList.add(targetDir);
        TXLIST.sort('timestamp', {
            order: targetDir
        });
    });

    refreshButton.addEventListener('click', listTransactions);
    /** ------------------ END Transaction --------------------- */
}
initBaseEvent();