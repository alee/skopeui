import {
  Module,
  VuexModule,
  Mutation,
  Action,
  MutationAction,
} from 'vuex-module-decorators'

// drawer visibility and v-stepper state
export const STEPS = Object.freeze({
  SELECT_DATASET: 1,
  DEFINE_STUDY_AREA: 2,
  ANIMATE_MAP: 3,
  VISUALIZE_DATA: 4,
  VIEW_METADATA: 5,
})

@Module({ stateFactory: true, namespaced: true, name: 'app' })
class App extends VuexModule {
  disableDrawer = 0
  currentStep = STEPS.SELECT_DATASET
  toggleDrawer = 0

  /**
   * Determine if drawer can be toggled.
   */
  @Mutation
  canShowDrawer() {
    if ((this.currentStep = 1)) {
      this.disableDrawer += 1
    } else {
      this.disableDrawer -= 1
    }
    return this.disableDrawer
  }

  /**
   * Toggle drawer with options to filter datasets.
   * @param {*} openDrawer
   */
  @MutationAction
  setDrawer(openDrawer) {
    if (this.canShowDrawer() && openDrawer) {
      this.toggleDrawer += 1
    } else {
      this.toggleDrawer -= 1
    }
  }

  /**
   * Set step from stepper navigation.
   * @param {*} step
   */
  @MutationAction
  setStep(step) {
    this.currentStep = step
  }
}

export { App }