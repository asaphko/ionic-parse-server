import { Injectable } from '@angular/core';
import 'rxjs/add/operator/map';

// Parse
import { Parse } from 'parse';

// Constants
import { ENV } from '../../app/app.constant';

@Injectable()
export class ParseProvider {
  private parseAppId: string = ENV.parseAppId;
  private parseServerUrl: string = ENV.parseServerUrl;

  constructor() {
    this.parseInitialize();
    console.log('Initiated Parse');
  }

  public getConfigObjects(offset: number = 0, limit: number = 3): Promise<any> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const ConfigObject = Parse.Object.extend('ConfigObject');
        let query = new Parse.Query(ConfigObject);
        query.skip(offset);
        query.limit(limit);
        query.descending("createdAt");
        query.find().then((configObjects) => {
          resolve(configObjects);
        }, (error) => {
          reject(error);
        });
      }, 500);
    });
  }

  public addConfigObject(newConfig): Promise<any> {
    const ConfigObject = Parse.Object.extend('ConfigObject');

    let configObject = new ConfigObject();
    configObject.set('state', newConfig.state);

    return configObject.save(null, {
      success: function (configObject) {
        return configObject;
      },
      error: function (configObject, error) {
        console.log(error);
        return error;
      }
    });
  }

  private parseInitialize() {
    Parse.initialize(this.parseAppId);
    Parse.serverURL = this.parseServerUrl;
  }

}
