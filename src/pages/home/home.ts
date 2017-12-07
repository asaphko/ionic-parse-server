import { Component, NgZone } from '@angular/core';
import { App, NavController, ToastController, Platform } from 'ionic-angular';
import { OneSignal } from '@ionic-native/onesignal'

// Providers
import { ParseProvider } from '../../providers/parse/parse';
import { AuthProvider } from '../../providers/auth/auth';
import { BLE } from '@ionic-native/ble';

// Pages
import { SigninPage } from '../signin/signin';

// Constants
import { ENV } from '../../app/app.constant';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  configObjects = [];
  peripherals: any[] = [];
  statusMessage: string;
  peripheral: any = {};
  isScanning: boolean = false;
  bleConnected: boolean = false;
  currentStateName: string;
  private deviceName: string = ENV.deviceName;
  private bluetoothSecretKey: string = ENV.bluetoothSecretKey;
  private oneSignalKey: string = ENV.oneSignalKey;

  constructor(platform: Platform,
              private parseProvider: ParseProvider,
              private auth: AuthProvider,
              private navCtrl: NavController,
              private toastCtrl: ToastController,
              private app: App,
              private oneSignal: OneSignal,
              private ble: BLE,
              private ngZone: NgZone) {

    this.listConfigs();

    platform.ready().then(() => {
      if (platform.is('cordova')) {
        // OneSignal Code start:
        this.oneSignal.startInit(this.oneSignalKey);
        this.oneSignal.inFocusDisplaying(this.oneSignal.OSInFocusDisplayOption.InAppAlert);
        this.oneSignal.handleNotificationReceived().subscribe(() => {
          // do something when notification is received
        });

        this.oneSignal.handleNotificationOpened().subscribe(() => {
          // do something when a notification is opened
        });
        this.oneSignal.endInit();
      }
    });
  }

  ionViewCanEnter(): boolean {
    return this.auth.authenticated();
  }

  public listConfigs(): Promise<any> {
    let offset = 0;
    let limit = 1;
    this.configObjects = [];
    return this.parseProvider.getConfigObjects(offset, limit).then((result) => {
      for (let i = 0; i < result.length; i++) {
        let object = result[i];
        if (object.get('state') == 0) {
          object.currentStateName = 'Unlocked';
        }
        else if (object.get('state') == 1) {
          object.currentStateName = 'Locked';
        }
        else {
          let num = parseInt(object.get('state'))-1;
          object.currentStateName = 'Triggered ('+ num +' times)';
        }
        this.configObjects.push(object);
      }
    }, (error) => {
      console.log(error);
    });
  }

  public lock() {
    let newConfig = {};
    newConfig['state'] = 1;
    this.parseProvider.addConfigObject(newConfig).then((configObject) => {
      this.configObjects = [];
      this.listConfigs();
    }, (error) => {
      console.log(error);
      alert('Error adding config.');
    });
  }

  public unlock() {
    let newConfig = {};
    newConfig['state'] = 0;
    this.parseProvider.addConfigObject(newConfig).then((configObject) => {
      this.configObjects = [];
      this.listConfigs();
    }, (error) => {
      console.log(error);
      alert('Error adding config.');
    });
  }

  public signout() {
    this.auth.signout().subscribe(() => {
      this.app.getRootNav().setRoot(SigninPage);
    });
  }

  ionViewDidEnter() {
    this.scan();
  }

  scan() {
    this.ngZone.run(() => {
      this.peripherals.push({});
    });
    this.peripherals = [];  // clear list
    this.isScanning = true;
    this.bleConnected = false;
    this.ble.scan([], 10).subscribe(
      device => this.onDeviceDiscovered(device),
      error => this.scanError(error)
    );

    setTimeout(this.setStatus.bind(this), 10000, false);
  }

  onDeviceDiscovered(device) {
    if (device.name == this.deviceName) {
      this.ble.connect(device.id).subscribe(
        peripheral => this.onConnected(peripheral),
        peripheral => this.onDeviceDisconnected(peripheral)
      );
    }
  }

  onConnected(peripheral) {
    this.ble.read(peripheral.id, '0003', '0004').then(
      data => this.afterRead(data, peripheral),
      e => this.setStatus('Error')
    );
  }

  afterRead(buffer:ArrayBuffer, peripheral) {
    var data = new Uint8Array(buffer);
    peripheral.state = data[0];
    this.isScanning = false;
    this.bleConnected = true;
    this.ngZone.run(() => {
      this.peripherals.push(peripheral);
    });
  }

  onDeviceDisconnected(peripheral) {
    this.isScanning = false;
    this.bleConnected = false;
    this.setStatus('TRACKSi Disconnected');
  }

  onLockSwitchChange(peripheral) {
    var data = this.toUTF8Array(this.bluetoothSecretKey);
    this.ble.write(peripheral.id, '0003', '0004', data.buffer).then(
      () => this.afterWrite(),
      e => this.setStatus('Error')
    );
  }

  toUTF8Array(str) {
    var utf8 = [];
    for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
                      0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
                      0x80 | ((charcode>>6) & 0x3f),
                      0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                      | (str.charCodeAt(i) & 0x3ff))
            utf8.push(0xf0 | (charcode >>18),
                      0x80 | ((charcode>>12) & 0x3f),
                      0x80 | ((charcode>>6) & 0x3f),
                      0x80 | (charcode & 0x3f));
        }
    }
    var z = new Uint8Array(utf8);
    //console.log(z);
    return z;
  }

  afterWrite() {
    this.setStatus('Done!');
    this.ionViewWillLeave();
  }

  scanError(error) {
    let toast = this.toastCtrl.create({
      message: 'BLE Scanning Error - is it on?',
      position: 'bottom',
      duration: 5000
    });
    toast.present();
  }

  setStatus(message) {
    let toast = this.toastCtrl.create({
      message: message,
      position: 'bottom',
      duration: 3000
    });
    toast.present();
  }

  ionViewWillLeave() {
    //console.log('ionViewWillLeave disconnecting Bluetooth');
    this.ngZone.run(() => {
      this.peripherals.push({});
    });
    this.peripherals = [];
    this.isScanning = false;
    this.ble.disconnect(this.peripheral.id).then(
      () => this.bleConnected = false,
      () => console.log('ERROR disconnecting ' + JSON.stringify(this.peripheral))
    )
  }

  doRefresh(refresher) {
    console.log('Begin async operation', refresher);
    this.listConfigs();
    this.scan();

    setTimeout(() => {
      console.log('Async operation has ended');
      refresher.complete();
    }, 2000);
  }
}
