import harden from '@agoric/harden';
import { insist } from '../../../../util/insist';

/* allowedTransitions is an array of arrays which gets turned into a
 * map. The map maps string states to an array of potential next
 * states. For example, 
 * const allowedTransitions = [
  ['open', ['closed']],
  ['closed', []],
 * ];
*/
const makeStateMachine = (initialState, allowedTransitionsArray) => {
  let state = initialState;
  const allowedTransitions = new Map(allowedTransitionsArray);
  return harden({
    canTransitionTo: nextState =>
      allowedTransitions.get(state).includes(nextState),
    transitionTo: nextState => {
      insist(allowedTransitions.get(state).includes(nextState));
      state = nextState;
    },
    getStatus: _ => state,
  });
};
harden(makeStateMachine);
export { makeStateMachine };
