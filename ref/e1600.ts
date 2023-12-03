import { SolixApi, Options as SolixE1600Config, LoginResultResponse as LoginResponse, SiteHomepageResponse, SiteDeviceParamResponse } from './api';

interface SolixE1600Schedule {
  ranges: Array<{
    id: number;
    start_time: string;
    end_time: string;
    turn_on: boolean;
    appliance_loads: Array<{
      id: number;
      name: string;
      power: number;
      number: number;
    }>;
  }>;
  min_load: number;
  max_load: number;
  step: number;
}

interface SolixE1600Device {
  siteId: string;
  paramType: string;
}

interface SolixE1600DeviceWithCommand extends SolixE1600Device {
  cmd: number;
  paramData: SolixE1600Schedule;
}

class SolixE1600 {
  private config: SolixE1600Config;
  private api: SolixApi;
  private apiSession: any; // You may need to replace 'any' with the actual type

  /**
   * Initializes a new instance of the constructor function.
   *
   * @param {SolixE1600Config} config - The configuration object for the constructor.
   * @throws {Error} Throws an error if username is not provided.
   * @throws {Error} Throws an error if password is not provided.
   */
  constructor(config: SolixE1600Config) {
    config.country = config.country ?? "DE";
    
    if (!config.username) {
      throw new Error('No username provided');
    }
    if (!config.password) {
      throw new Error('No password provided');
    }
    this.config = config;
    this.api = new SolixApi(config);
  }

  /**
   * Initializes the instance
   *
   * @return {Promise<void>}
   */
  async _init(): Promise<void> {
    if (!this.config.loginCredentials) {
      const loginResponse: LoginResponse = await this.api.login();
      console.log('LoginResponse', loginResponse);
      if (loginResponse.code === 100053) {
        throw new Error(loginResponse.msg);
      } else {
        this.config.loginCredentials = loginResponse.data;
      }
    }

    if (!this.config.loginCredentials) {
      throw new Error('Unable to retrieve auth_token during API login');
    }

    if (typeof this.apiSession === 'undefined') {
      try {
        this.apiSession = this.api.withLogin(this.config.loginCredentials);
      } catch (e) {
        console.error(e);
        delete this.config.loginCredentials;
        throw new Error('Login failed');
      }
    }
  }

  /**
   * Retrieves the site ID for a given site.
   *
   * @param {string|number} site - The site ID or name.
   * @return {Promise<string>} - The site ID.
   */
  async _getSiteId(site: string | number): Promise<string> {
    await this._init();
    const sites: Array<any> = await this.getSites();

    if (typeof site === 'string') {
      for (let i = 0; i < sites.length; i++) {
        if (site[i].site_id === site) {
          site = i;
          break;
        }
      }
    }

    let site_idx = site;

    if (typeof site_idx === 'undefined' || site_idx == null || isNaN(site_idx)) {
      site_idx = 0;
    }

    if (sites.length < site_idx + 1) {
      throw new Error('site out of range. Expected < ' + (sites.length - 1) + ' or valid site_id');
    }

    return sites[site_idx].site_id;
  }

  /**
   * Retrieves the session configuration.
   *
   * @return {SolixE1600Config} - The session configuration.
   */
  getSessionConfiguration(): SolixE1600Config {
    return this.config;
  }

  /**
   * Retrieves the list of sites.
   *
   * @return {Promise<Array<any>>} - The list of sites.
   */
  async getSites(): Promise<Array<any>> {
    const sites: SiteHomepageResponse = await this.getSitehomepage();
    return sites.site_list;
  }

  /**
   * Retrieves the site homepage from the API.
   *
   * @return {Promise<SiteHomepageResponse>} - A Promise that resolves to the site homepage (account overview) data.
   */
  async getSitehomepage(): Promise<SiteHomepageResponse> {
    await this._init();
    let sites: SiteHomepageResponse = await this.apiSession.siteHomepage();

    if (typeof sites === 'undefined') {
      await new Promise(r => setTimeout(r, 1000));
      sites = await this.apiSession.siteHomepage();

      if (typeof sites === 'undefined') {
        throw new Error('Unable to retrieve Sitehomepage');
      }
    }

    return sites.data;
  }

  /**
   * Retrieves the schedule for the specified site.
   *
   * @param {string} site - The site identifier or site index. If not provided, the first site is used.
   * @return {Promise<SolixE1600Schedule>} - The schedule data.
   */
  async getSchedule(site: string): Promise<SolixE1600Schedule> {
    const device: SolixE1600Device = {
      siteId: await this._getSiteId(site),
      paramType: '4',
    };

    const deviceParams: SiteDeviceParamResponse = await this.apiSession.getSiteDeviceParam(device);
    return deviceParams.data.param_data;
  }

  /**
   * Sets the schedule for a specific site.
   *
   * @param {SolixE1600Schedule} schedule - The schedule to set.
   * @param {string} site - The site for which the schedule should be set. If not provided, the first site is used.
   * @return {Promise<any>} - A promise that resolves with the response from setting the schedule.
   */
  async setSchedule(schedule: SolixE1600Schedule, site: string): Promise<any> {
    const deviceN: SolixE1600DeviceWithCommand = {
      siteId: await this._getSiteId(site),
      paramType: '4',
      cmd: 17,
      paramData: schedule,
    };

    const setResponse: any = await this.apiSession.setSiteDeviceParam(deviceN);
    return setResponse;
  }
}
