/**
 * Actions used by the visualize and analysis vue components
 */

// Would need to make a custom debounce decorator so
// that debounced methods can exist in a vue-class-component
//
// Could use or take from https://github.com/bvaughn/debounce-decorator
import _ from "lodash";
import {
  TIMESERIES_V2_ENDPOINT,
  METADATA_ENDPOINT,
} from "@/store/modules/constants";
import { extractYear } from "@/store/stats";

async function updateTimeSeries(api, data) {
  const dataset = api.dataset;
  const { time_range } = data;
  if (!dataset.canHandleTimeSeriesRequest) {
    console.log("Cannot handle timeseries request. Aborting.");
    dataset.setTimeSeriesNoArea();
    return;
  }
  dataset.setTimeSeriesLoading();
  const start = time_range.gte;
  const end = time_range.lte;
  if (start > end) {
    api.messages.info("Please select a start year before the end year");
    return;
  }
  try {
    const response = await api.store.$axios.$post(TIMESERIES_V2_ENDPOINT, data);
    const originalSeries = response.series[0];
    const timeseries = {
      x: _.range(
        extractYear(originalSeries.time_range.gte),
        extractYear(originalSeries.time_range.lte) + 1
      ),
      y: originalSeries.values,
      options: originalSeries.options,
    };
    const numberOfCells = response.n_cells;
    const totalCellArea = response.area;
    dataset.setTimeSeries({ timeseries, numberOfCells, totalCellArea });
    dataset.setTimeSeriesLoaded();
  } catch (e) {
    dataset.clearTimeSeries();
    if (e.response) {
      // https://github.com/axios/axios#handling-errors
      const statusCode = e.response.status;
      const responseData = e.response.data;
      console.error("failed timeseries request: ", {
        statusCode,
        responseData,
      });
      if (statusCode === 504) {
        dataset.setTimeSeriesTimeout();
      } else if (statusCode >= 500) {
        console.error("server error: ", e);
        dataset.setTimeSeriesServerError(responseData.detail);
      } else if (statusCode >= 400) {
        // 422 = validation error
        dataset.setTimeSeriesBadRequest(responseData.detail);
      } else if (statusCode === 200) {
        dataset.setTimeSeriesSuccess();
      } else {
        console.error("Unhandled status code: ", statusCode);
      }
    } else if (e.request) {
      // browser made a request but didn't see a response, likely a timeout / client network error
      // FIXME: distinguish between this and a server side timeout eventually
      dataset.setTimeSeriesTimeout();
    }
  }
}

export const retrieveTimeSeries = _.debounce(updateTimeSeries, 300);

export const loadTimeSeries = _.debounce(async function (api) {
  const dataset = api.dataset;
  console.log("loading time series? ", dataset.canHandleTimeSeriesRequest);
  if (dataset.canHandleTimeSeriesRequest) {
    updateTimeSeries(api, dataset.timeseriesRequestData);
  }
}, 300);

const updateAnalysis = _.debounce(async function (api, data) {
  try {
    api.analysis.setResponse(
      await api.store.$axios.$post(TIMESERIES_V2_ENDPOINT, data)
    );
  } catch (e) {
    api.analysis.setResponseError(e);
  }
}, 300);

export async function retrieveAnalysis(api, data) {
  api.analysis.setWaitingForResponse(true);
  try {
    await updateAnalysis(api, data);
  } finally {
    api.analysis.setWaitingForResponse(false);
  }
}

export async function loadAllDatasetMetadata(api) {
  try {
    const all_dataset_metadata = await api.store.$axios.$get(METADATA_ENDPOINT);
    // do something with response.data;
    console.log("response data:", all_dataset_metadata);
    api.metadata.setAllDatasetMetadata(all_dataset_metadata);
  } catch (e) {
    console.error(e);
    // should start to use the messages component to display user messages
    alert("Unable to access skope api metadata at: " + METADATA_ENDPOINT);
  }
}

export async function loadMetadata(api, id) {
  const datasetMetadata = api.metadata.find(id);
  api.dataset.setMetadata(datasetMetadata);
}

export function saveGeoJson(warehouse, api, geoJson) {
  warehouse.set(api.dataset.geoJsonKey, geoJson);
  api.dataset.setGeoJson(geoJson);
}

export function filterDatasetMetadata(api, filterCriteria) {
  api.metadata.setFilterCriteria(filterCriteria);
}

export function initializeDataset(warehouse, api, metadataId, variableId) {
  const datasetMetadata = api.metadata.find(metadataId);
  api.dataset.setMetadata(datasetMetadata);
  if (variableId == null) {
    // set a default variable if no variable id was passed in
    variableId = datasetMetadata.variables[0].id;
  }
  api.dataset.setVariable(variableId);
  if (process.client) {
    initializeDatasetGeoJson(warehouse, api);
  }
}

export function initializeDatasetGeoJson(warehouse, api) {
  if (api.dataset.hasGeoJson) {
    console.log("dataset store already has geojson, no-op");
    return;
  }
  const geoJson = warehouse.get(api.dataset.geoJsonKey) || null;
  console.log("setting geo json: ", geoJson);
  api.dataset.setGeoJson(geoJson);
}

export function clearGeoJson(warehouse, api) {
  warehouse.remove(api.dataset.geoJsonKey);
  api.dataset.clearGeoJson();
}

// load data from api.analysis.request if any
// assume that it would be cleared by any actions that invalidate the request data
// (change in dataset, study area, or variable)
export async function loadRequestData(api) {
  const requestData = api.analysis.request;
  console.log("request data in the store: ", requestData);
  if (_.isEmpty(requestData)) {
    api.analysis.setDefaultRequestData(api.dataset.defaultApiRequestData);
  }
}
