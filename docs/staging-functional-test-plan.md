# Try SKOPE on staging

This guide is for science-team members and other users who know the datasets
and can judge whether the results make scientific sense. You do not need access
to deployment tools, server logs, browser developer tools, or version numbers.

Use the staging link supplied with your invitation. Staging is a testing site;
save any downloads you want to keep. Start with a small area and a dataset you
know well. Allow about 20–30 minutes for the main checks; the scientific
comparison can take longer if you need to prepare reference values.

## Before you begin

The testing coordinator should supply:

- The staging link and which datasets or changes need attention.
- At least one scientific comparison case: a precise study area, variable,
  dates, analysis settings, independently checked expected values, and an
  acceptable numerical tolerance. Tell testers where those values came from.
- Any known limitations, and who to contact if the whole site is unavailable.

If a reference case is unavailable, you can still test the workflow and use your
scientific judgment. Mark the numerical comparison **not checked**; a plausible
plot is not proof that the calculation is correct.

## Walk through a familiar dataset

For each step, record **works**, **problem**, or **not checked**. If something
looks wrong, use **Report a bug** while you are still on that page. Explain what
you expected, what actually happened, and how to repeat it. Technical details
are collected for you; you do not need to find commits or image IDs.

### Find the right data

1. Browse or search for a familiar dataset. Try a filter you would normally use.
   **Look for:** relevant results and clear dataset names and descriptions.
2. Open the dataset and read its variables, units, dates, sources, and limitations.
   **Look for:** information that agrees with your understanding of the data.
   Report misleading labels or missing scientific context as well as broken controls.

### Explore an area

3. Draw or select a small study area, then open **Visualize**.
   **Look for:** the intended area, a readable map and legend, and a time series.
4. Change the variable or displayed date where available. Pan and zoom the map.
   **Look for:** the map, legend, dates, and units changing together. Known spatial
   patterns should be recognizable. Missing coverage should not look like zero.
5. Change the study area and move between **Visualize** and **Analyze**.
   **Look for:** results describing the current selection, with no old area's
   values appearing under the new area's labels. Navigation should feel coherent.

### Analyze and download

6. On **Analyze**, start with the original, unsmoothed series. Compare the plot
   and summary statistics with your scientific comparison case below.
7. Try the spatial mean and median, then an analysis option you actually use,
   such as a moving average or standardized values. Change the time interval.
   **Look for:** understandable controls, correct labels and reference periods,
   and results consistent with the selected method. It is valid for mean and
   median to differ; neither is always larger.
8. Download the result and open the numeric file and plot image.
   **Look for:** correct dataset, variable, units, dates, and analysis choices.
   Numeric values should agree with the plotted series, allowing for display
   rounding. Numeric files contain the selected interval; plot images preserve
   the current zoom, so zooming does not remove rows from the numeric export.
9. Change an analysis option and try downloading while the result is updating.
   **Look for:** Download becoming available only after the current analysis
   succeeds, so you cannot accidentally export an older result as the new one.

## Check scientific results

Use the supplied comparison case with the exact same study area, dates and
settings. Record the expected and observed values and the tolerance used.

- **Values and units:** compare several named dates, including the beginning
  and end of the interval. Check sign, magnitude, units and chronological order.
- **Spatial statistics:** compare mean and median against calculations from the
  underlying selected raster cells. A map color is not a numeric reference.
  Check how cells at the study-area boundary are selected in the reference case.
- **Summary statistics:** independently check a short unsmoothed series. Missing
  values must not become zeros. SKOPE uses population standard deviation.
- **Analysis methods:** for methods you know, check the window length, reference
  period and edge behavior against the agreed reference. A fixed-reference
  z-score uses that reference period's mean and population standard deviation;
  a constant or missing reference can make it undefined.
- **Range changes:** untransformed values at overlapping dates should stay the
  same when you narrow the interval. For transformed values, keep the method,
  smoothing settings and explicit reference period fixed when comparing.
- **Missing data:** where a known gap exists, confirm the plot, summary and export
  handle it consistently. Smoothing edges or undefined transforms can create
  additional missing values; those need interpretation rather than automatic failure.

These are targeted acceptance checks, not a new validation of the entire source
dataset. Report a scientifically suspicious result even if every control works.

## Try ordinary interruptions

These checks are optional. Do not interrupt other testers or try to overload the site.

- Change your selection while results are loading. The final result should
  describe your latest selection.
- If you encounter an error, read the message and use Retry if offered. It
  should explain a useful next step and let you continue when the problem clears.
- Try a narrower browser window and use the keyboard for a few controls.
  Note anything unreadable, unreachable or unexpectedly difficult.

You do not need to disconnect requests, terminate workers, inspect network
traffic, or prove how many jobs ran. Maintainers handle those checks separately.

## Share your findings

Use **Report a bug** for each distinct problem. Include what you expected,
what happened, and enough steps to repeat it. For a numerical discrepancy,
include the reference source, expected value, observed value and tolerance.
Use a screenshot if it helps, but do not include information you do not want to share.

If reporting from the site fails, keep your notes and use the contact address
provided by the coordinator or the site's Contact link.

A short completion note is enough:

```text
Name (optional) and date:
Datasets and variables tried:
Study area and dates:
Workflow: works / problem / not checked
Scientific comparison: agrees / differs / not checked
Reference used and tolerance:
Bug report references, or brief notes:
Anything confusing or difficult:
```

Maintainers prepare the site and run deployment/recovery checks using the
[engineering checklist](staging-maintainer-checklist.md). Deployment readiness
and scientific acceptance are recorded separately.
