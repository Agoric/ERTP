import harden from '@agoric/harden';

// Returns a makeConfig function like `superMakeConfig`, except that
// its makeAssay function will ignore the label passed to it, and
// instead use `remoteLabel` for the assays it makes. Those assays
// will therefore label the amounts it makes with `remoteLabel`
// instead of the label that was passed to makeAssay.
function makeRemoteLabelConfigMaker(superMakeConfig, remoteLabel) {
  function makeRemoteLabelConfig() {
    const { makeAssay: superMakeAssay, ...restConfig } = superMakeConfig();
    function makeAssayWithRemoteLabel(_ignoredLabel) {
      return superMakeAssay(remoteLabel);
    }
    return harden({
      ...restConfig,
      makeAssay: makeAssayWithRemoteLabel,
    });
  }
  return harden(makeRemoteLabelConfig);
}

export { makeRemoteLabelConfigMaker };
