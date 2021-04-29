import _ from "lodash";
import { Module, VuexModule, Mutation, Action } from "vuex-module-decorators";
import { API } from "@/plugins/store";
import { TIMESERIES_V2_ENDPOINT } from "@/store/modules/constants";
import { filterTimeSeries, summarize } from "@/store/stats";

const updateAnalysis = _.debounce(async function (vuex, data) {
  const api = new API(vuex.store);
  try {
    api.analysis.setResponse(
      await vuex.store.$axios.$post(TIMESERIES_V2_ENDPOINT, data)
    );
  } catch (e) {
    api.analysis.setResponseError(e);
  }
}, 300);

const EMPTY_RESPONSE = {
  time_range: { gte: 0, lte: 0 },
  values: [],
  n_cells: 1,
  area: 0,
};

@Module({ stateFactory: true, name: "analysis", namespaced: true })
class Analysis extends VuexModule {
  request = {};
  waitingForResponse = false;
  response = EMPTY_RESPONSE;
  responseError = {};

  get timeseries() {
    return {
      x: _.range(this.response.time_range.gte, this.response.time_range.lte),
      y: this.response.values,
    };
  }

  get summaryStatistics() {
    return { ...summarize(this.filteredTimeSeries), series: "Transformed" };
  }

  /*
  get temporalRange() {
    return this.context.rootState["dataset/temporalRange"];
  }

  get minYear() {
    return this.context.rootGetters["dataset/minYear"];
  }
  */

  get filteredTimeSeries() {
    return filterTimeSeries({
      timeseries: this.timeseries,
      temporalRange: [1000, 1500],
      minYear: 1,
    });
  }

  @Mutation
  setWaitingForResponse(value) {
    this.waitingForResponse = value;
  }

  @Mutation
  setResponse(response) {
    console.log({ response });
    this.response = response;
  }

  @Mutation
  clearResponse() {
    this.response = EMPTY_RESPONSE;
  }

  @Mutation
  setResponseError(e) {
    console.log({ e });
    this.responseError = e;
  }

  @Action
  async retrieveAnalysis(data) {
    this.setWaitingForResponse(true);
    try {
      await updateAnalysis(this, data);
    } finally {
      this.setWaitingForResponse(false);
    }
  }
}

export { Analysis };
