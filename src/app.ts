import { ApiWithLogin, LoginResultResponse, ParamData, ParamType, SolixApi } from "./api";
import { anonymizeConfig, getConfig } from "./config";
import { consoleLogger } from "./logger";
import { sleep } from "./utils";
import { Publisher } from "./publish";
import { FilePersistence, Persistence } from "./persistence";

const config = getConfig();
const logger = consoleLogger(config.verbose);

function isLoginValid(loginData: LoginResultResponse, now: Date = new Date()) {
  return new Date(loginData.token_expires_at * 1000).getTime() > now.getTime();
}

async function run(): Promise<void> {
  logger.log(JSON.stringify(anonymizeConfig(config)));
  const api = new SolixApi({
    username: config.username,
    password: config.password,
    country: config.country,
    logger,
  });

  const persistence: Persistence<LoginResultResponse> = new FilePersistence(config.loginStore);

  const publisher = new Publisher(config.mqttUrl, config.mqttRetain, config.mqttClientId.length > 0 ? config.mqttClientId : undefined, config.mqttUsername, config.mqttPassword);
  async function fetchAndPublish(): Promise<void> {
    logger.log("Fetching data");
    let loginData = await persistence.retrieve();
    if (loginData == null || !isLoginValid(loginData)) {
      const loginResponse = await api.login();
      loginData = loginResponse.data ?? null;
      if (loginData) {
        await persistence.store(loginData);
      } else {
        logger.error(`Could not log in: ${loginResponse.msg} (${loginResponse.code})`);
      }
    } else {
      logger.log("Using cached auth data");
    }
    if (loginData) {
      const loggedInApi = api.withLogin(loginData);
      const siteHomepage = await loggedInApi.siteHomepage();
      let topic = `${config.mqttTopic}/site_homepage`;
      await publisher.publish(topic, siteHomepage.data);
      for (const site of siteHomepage.data?.site_list ?? []) {
        // scen info
        const scenInfo = await loggedInApi.scenInfo(site.site_id);
        topic = `${config.mqttTopic}/site/${site.site_name}/scenInfo`;
        await publisher.publish(topic, scenInfo.data);
        // schedule
        const deviceParams = await loggedInApi.getSiteDeviceParam( {
          siteId: site.site_id,
          paramType: ParamType.LoadConfiguration,
        }) ;
        const schedule = deviceParams.data.param_data;
        topic = `${config.mqttTopic}/site/${site.site_name}/schedule`;
        await publisher.publish(topic, schedule);

        const test = await loggedInApi.getSiteDeviceParam( {
          siteId: site.site_id,
          paramType: "3" as any,
        }) ;

        const test2 = await loggedInApi.getSiteDeviceParam( {
          siteId: site.site_id,
          paramType: "2" as any,
        }) ;

        const test1 = await loggedInApi.getSiteDeviceParam( {
          siteId: site.site_id,
          paramType: "1" as any,
        }) ;

        const test5 = await loggedInApi.getSiteDeviceParam( {
          siteId: site.site_id,
          paramType: "6" as any,
        }) ;

        const test6 = await loggedInApi.getSiteDeviceParam( {
          siteId: site.site_id,
          paramType: "6" as any,
        }) ;
        var x = 0;
      }
      logger.log("Published.");
    } else {
      logger.error("Not logged in");
    }
  }

  for (;;) {
    const start = new Date().getTime();
    try {
      await fetchAndPublish();
    } catch (e) {
      logger.warn("Failed fetching or publishing printer data", e);
    }
    const end = new Date().getTime() - start;
    const sleepInterval = config.pollInterval * 1000 - end;
    logger.log(`Sleeping for ${sleepInterval}ms...`);
    await sleep(sleepInterval);
  }
}

run()
  .then(() => {
    logger.log("Done");
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
