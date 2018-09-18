# WalletShell

This is a GUI wallet for Bitcoin nova made using Electron, this means it's written in JavaScript, HTML and CSS. 

It is meant to be able to work on Windows, Linux and MacOS, however so far we've only been able to test it on Linux &amp; Windows.

![WalletShell Screens](http://pool.bitcoinn.biz/bitcoin-nova.png "WalletShell Screens")

### Features:
This wallet contains the basic functions required to manage your Bitcoin nova wallet:
  * Basic tasks: Open an existing wallet file, create new wallet file, import an existing wallet using keys or mnemonic seed
  * Wallet operations: display wallet balance, list transactions, send new transaction, display/export private keys &amp; mnemonic seed
  * Address book: store and label your contact's wallet address, searchable and can be looked up during sending new transaction
  * UI/Misc: Provides up-to-date public node address or specify your own local node, able to specify start scan height when importing wallet for faster sync, incoming transaction notification, minimize/close to system tray.

There is still plenty of room for improvements and features, so we will gladly accept help from anyone who is capable of lending a hand.

### Notes

WalletShell relies on `Bitcoinnova-service` to manage wallet container &amp; rpc communication.

WalletShell release packaged includes ready to use `Bitcoinnova-service` binary, which is unmodified copy Bitcoin nova release archive.

On first launch, WalletShell will try to detect location/path of bundled `Bitcoinnova-service` binary, but if it's failed, you can set path to the `Bitcoinnova-service` binary on the Settings tab.

If you don't trust the bundled `Bitcoinnova-service` file, you can compare the sha256 sum against one from the official release, or just download and use binary from official Bitcoin nova release, which you can download here: https://github.com/Bitcoin-N/Bitcoinnova/releases. Then,  make sure to update your `Bitcoinnova-service` path setting.

### Download &amp; Run WalletShell

* Download latest packaged release for your platform here: https://github.com/Bitcoin-N//Bitcoinnova-wallet-electron/releases

* Extract downloaded file
* Open/Run the wallet executable, located in the extracted directory:  
  * GNU/Linux: `walletshell-<version>-linux/walletshell`
  * Windows: `walletshell-<version>-windows/walletshell.exe`
  * macOS: ?? `walletshell-<version>-osx/walletshell.app/Contents/MacOs/walletshell` ??


### Build
You need to have `Node.js` and `npm` installed, go to https://nodejs.org and find out how to get it installed on your platform.

Once you have Node installed:
```
# first, download Bitcoinnova-service binary for each platform
# from Bitcoin nova official repo
# https://github.com/Bitcoin-N/Bitcoinnova/releases
# extract the Bitcoinnova-service executable somewhere

# clone the repo
$ git clone https://github.com/Bitcoin-N/Bitcoinnova-wallet-electron
$ cd Bitcoinnova-wallet-electron

# install dependencies
$ npm install

# create build directory
$ mkdir ./build

# copy/symlink icons from assets, required for packaging
$ cp ./src/assets/icon.* ./build/

# build GNU/Linux package
$ mkdir -p ./tbin/lin
$ cp /path/to/linux-version-of/Bitcoinnova-service ./tbin/lin/
$ npm run linpack

# build Windows package
$ mkdir -p ./tbin/win
$ cp /path/to/win-version-of/Bitcoinnova-service.exe ./tbin/win/
$ npm run winpack

# build OSX package
$ mkdir -p ./tbin/osx
$ cp /path/to/osx-version-of/Bitcoinnova-service ./tbin/osx/
$ npm run osxpack
```

You can find the resulting walletshell binary in a ready to package folder inside `build/walletshell-<platform>-<arch>` subdirectory.


