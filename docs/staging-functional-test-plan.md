# Try SKOPE on staging

This guide is for science team members and other users who know the datasets
and can judge whether the results make scientific sense. Allow 20–30 minutes
for the main walkthrough. Comparing results with independent calculations may
need a separate session.

Open [staging.openskope.org](https://staging.openskope.org). Start with a small
area and a dataset you know well. Staging is a testing site; save downloads you
want to keep.

## What to record

Mark each numbered check **works**, **problem**, or **not checked**. If you
cannot reach a check because an earlier step failed, mark it **not checked**
and say what blocked it. Report unclear labels, missing scientific context and
unexpected results as well as broken controls.

Use **Report a bug** in the top bar while you are still on the page with the
problem. Describe what you expected, what happened, and how to repeat it.
Technical details are collected for you. Keep the report reference shown after
sending; you do not need to find version numbers or use browser developer tools.

## Before inviting the science team

The coordinator should provide the datasets or changes that need attention,
known limitations, and a contact for a site outage. For numerical checks, supply
at least one comparison case with the following information:

```text
Case name:
Dataset and variable:
Study area: exact longitude/latitude (WGS84) or a supplied boundary file
Dates and calendar convention:
Spatial statistic: mean / median / point value
Transformation and reference period, if any:
Smoothing method and window, if any:
Reference source and how the expected values were checked:
How cells at the area boundary and missing values were handled:
Expected values at named dates, with units:
Expected summary statistics, if checked:
Acceptable difference: absolute and/or relative tolerance
```

Agree on the reference and tolerance before comparing results. A roughly
similar area drawn by hand may include different cells and give different values.
If a reference case is unavailable, continue the walkthrough and mark numerical
comparisons **not checked**. A plausible plot alone does not establish accuracy.

## Walk through a familiar dataset

Change one setting at a time and wait for the result before continuing, except
when a check specifically asks you to change something while it is loading.

### Find and visualize

1. **Find a dataset.** Browse or search, then try a filter you would normally use.
   Open the dataset information and inspect variables, units, dates, sources,
   license and limitations. Results and descriptions should match your search
   and your understanding of the data.
2. **Select a small area and open Visualize.** Confirm the intended location,
   readable legend, variable, units and time series. Check whether familiar
   spatial patterns are recognizable. Missing coverage should not look like zero.
3. **Explore dates and variables.** Step through a few dates, including the first
   and last available dates. Try play and pause if animation is available. The
   displayed map and selected date should agree once loading finishes. Change
   the variable where available and check its name, units and legend.
4. **Change the study area.** Use **Edit study area**, choose a visibly different
   location, and return to Visualize. Then open Analyze. Confirm the area and
   results describe the new selection. Different areas can have the same values;
   equality alone does not prove that an old result was reused.

### Analyze and download

5. **Inspect the original series.** On Analyze, start with no transformation or
   smoothing. If using a reference case, first restore its exact area, variable,
   dates and spatial statistic. Compare several named dates and the summary
   statistics with the reference. Check units, sign, magnitude and date order.
6. **Try an analysis you use.** For an area, try spatial mean and median
   separately, clicking **Update** after each change; this control is unavailable
   for a point. Then try a familiar transformation or smoothing method and click
   **Update**. Check the displayed result and its labels against your selected
   method, window and reference period. Mean and median may differ; neither is
   always larger.
7. **Change the interval.** Use **From**, **To** and **Apply** to select a shorter
   interval. Check the dates shown and the statistics for that interval. Values
   at overlapping dates should stay the same for the original unsmoothed series.
   For transformed or smoothed series, use the comparison guidance below.
8. **Download and inspect the result.** Open the ZIP, numeric file and plot image.
   Confirm the dataset, variable, units, dates and analysis choices. Compare a few
   numeric values with the plot, allowing for display rounding. Numeric files
   contain the selected interval; plot images preserve the current zoom, so
   zooming does not remove rows from the numeric export.
9. **Download after a change.** Change an analysis setting and click **Update**.
   While it is loading, Download should be unavailable. After success, download
   again and check that it describes the new result. If the update fails, report
   whether the displayed result and available actions are understandable.
   If the update finishes too quickly to check the loading state, mark that part
   **not checked**.

## Compare scientific results

Use the supplied case with exactly the same area, dates and settings. Record
expected and observed values and the tolerance used. These are focused checks
of SKOPE's results; they do not establish the validity of the source dataset.

- **Spatial statistics:** compare mean and median with independent calculations
  from the selected raster cells, using the same boundary convention and missing
  data treatment. A map color is not a numeric reference.
- **Summary statistics:** independently check a short unsmoothed series. Missing
  values must not become zeros. SKOPE uses population standard deviation.
- **Analysis methods:** check window length, reference period and behavior at
  the ends of the series against the agreed reference. A fixed reference z-score
  uses that period's mean and population standard deviation; a constant or
  missing reference can make it undefined.
- **Range changes:** keep the method, window and explicit reference period fixed
  when comparing transformed values. Changes in the available context for
  smoothing can affect values near the ends; use the reference case to judge
  whether those differences are expected.
- **Missing data:** where a known gap exists, confirm the plot, summary and export
  handle it consistently. Smoothing edges or undefined transforms can introduce
  additional missing values. Record these separately from gaps in the source.

For each numerical comparison, record:

```text
Case and quantity checked (including date or statistic):
Expected value and units:
Observed value and units:
Tolerance:
Result: agrees / differs / not checked
Report reference or notes:
```

Report a scientifically suspicious result even if every control works. If you
cannot tell whether a difference is expected, record the uncertainty for review.

## Optional checks

- Change your selection while results are loading. The final result should
  describe your latest selection.
- If an error occurs, read the message and use Retry if offered. Check whether
  it explains a useful next step and lets you continue when the problem clears.
- Try a narrow browser window and use the keyboard for a few controls. Check
  that Report a bug remains visible. User Guide and Contact are in the help menu
  when the window is too narrow to show them directly.

Do not try to overload the site or interrupt other testers. Maintainers handle
server failures and recovery checks using the
[engineering checklist](staging-maintainer-checklist.md).

## Share your findings

Send one bug report per distinct problem. For a numerical discrepancy, include
the case, reference source, expected and observed values, and tolerance. Attach
a screenshot if helpful. Review the attached details and leave out the study
area or screenshot if it contains information you do not want to share.

If sending fails, use **Save a copy** and contact the coordinator or use Contact
in the top navigation. Keep any screenshot separately. Copy an unsent description
into your notes before reloading; reloading loses the draft.

Send a short completion note, even if everything worked:

```text
Name (optional), date and browser:
Dataset, variables, area and dates tried:
Checks 1–9: list each as works / problem / not checked
Scientific comparisons: case names and agrees / differs / not checked
Report references and any blocked checks:
Anything confusing or difficult:
```

The coordinator should review workflow problems, scientific discrepancies and
checks that were not completed separately. Deployment readiness and scientific
acceptance are recorded separately.
