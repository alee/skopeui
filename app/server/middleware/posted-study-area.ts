import { parsePostedStudyArea } from "../../utils/postedStudyArea";

export default defineEventHandler(async (event) => {
  if (
    event.method !== "POST" ||
    !/^\/dataset\/\w+\/?$/.test(getRequestURL(event).pathname)
  )
    return;

  try {
    const body = await readRawBody(event);
    event.context.postedStudyArea = parsePostedStudyArea(body || "");
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "studyArea must contain one GeoJSON point or polygon.",
    });
  }
  // Continue rendering the dataset page. Nuxt carries the feature to the
  // browser in its escaped payload, without cookies or shared server state.
  setResponseHeader(event, "Cache-Control", "no-store");
});
