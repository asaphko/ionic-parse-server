import { Component, NgZone } from '@angular/core';
import { NavController, ToastController, NavParams, AlertController } from 'ionic-angular';
import { ParseProvider } from '../../providers/parse/parse';

@Component({
  selector: 'page-history',
  templateUrl: 'history.html',
})
export class HistoryPage {

  configObjects = [];
  statusMessage: string;
  currentStateName: string;

  constructor(public navCtrl: NavController,
              public navParams: NavParams,
              private alertCtrl: AlertController,
              private toastCtrl: ToastController,
              private ngZone: NgZone,
              private parseProvider: ParseProvider,) {
    this.listConfigs();
  }

  public listConfigs(): Promise<any> {
    let offset = 0;
    let limit = 20;
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

  doRefresh(refresher) {
    console.log('Begin async operation', refresher);
    this.listConfigs();

    setTimeout(() => {
      console.log('Async operation has ended');
      refresher.complete();
    }, 2000);
  }

}
