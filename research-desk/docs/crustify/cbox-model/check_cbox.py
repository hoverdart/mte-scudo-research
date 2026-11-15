"""Finite abstract lifecycle check, NOT a proof or execution of ffibox Rust.
One allocation; <=2 shared handles; sequential, no unwinding/reentrancy.
A CDrop invocation consumes the ownership claim, not necessarily the storage.
Unsafe adoption/foreign operations must honor the modeled contracts.
"""
from dataclasses import dataclass, replace
from collections import deque
import json

@dataclass(frozen=True)
class State:
    owner: str = 'external'  # external / box / released / leaked
    shared: int = 0
    exclusive: bool = False
    dropCalls: int = 0
    policy: int = 0

def invariant(s):
    return (0 <= s.dropCalls <= 1 and 0 <= s.shared <= 2
            and not (s.shared and s.exclusive)
            and (not (s.shared or s.exclusive) or s.owner == 'box')
            and (s.owner != 'released' or s.dropCalls == 1)
            and (s.dropCalls == 0 or s.owner == 'released'))

def transitions(s, mutant=None):
    free = not s.shared and not s.exclusive
    if s.owner == 'external':
        yield 'unsafe_adopt_with_unique_claim', replace(s, owner='box')
    if s.owner == 'box':
        yield 'as_ptr_no_ownership_transfer', s
        if not s.exclusive and s.shared < 2:
            yield 'as_ref', replace(s, shared=s.shared + 1)
        if free or mutant == 'mutable_over_shared':
            yield 'as_mut', replace(s, exclusive=True)
        if s.shared:
            yield 'end_shared_handle', replace(s, shared=s.shared - 1)
        if s.exclusive:
            yield 'end_exclusive_handle', replace(s, exclusive=False)
        if free:
            yield 'into_raw_with_disarm', replace(s, owner='external',
                dropCalls=s.dropCalls + (mutant == 'into_raw_runs_drop'))
            yield 'with_compatible_policy', replace(s, policy=1-s.policy)
            yield 'mem_forget', replace(s, owner='leaked')
        if free or mutant == 'drop_with_live_handle':
            yield 'normal_drop_calls_policy', replace(s, owner='released', dropCalls=s.dropCalls+1)

def explore(mutant=None):
    start = State()
    queue = deque([(start, [])]); seen = {start}; edges = 0
    while queue:
        state, path = queue.popleft()
        assert invariant(state)
        for label, nextState in transitions(state, mutant):
            edges += 1
            nextPath = path + [label]
            if not invariant(nextState):
                return dict(mutant=mutant, invariantHolds=False, statesVisited=len(seen),
                            transitionsChecked=edges, counterexample=nextPath,
                            violatingState=nextState.__dict__)
            if nextState not in seen:
                seen.add(nextState); queue.append((nextState, nextPath))
    return dict(mutant=mutant, invariantHolds=True, statesVisited=len(seen),
                transitionsChecked=edges, counterexample=None)

def check_controls():
    s = State()
    def take(label):
        nonlocal s
        s = dict(transitions(s))[label]
        assert invariant(s)
    take('unsafe_adopt_with_unique_claim'); take('as_ref'); take('end_shared_handle')
    take('as_mut'); take('end_exclusive_handle'); take('into_raw_with_disarm')
    assert s.dropCalls == 0 and s.owner == 'external'
    take('unsafe_adopt_with_unique_claim'); take('normal_drop_calls_policy')
    assert s.dropCalls == 1
    leaked = dict(transitions(State(owner='box')))['mem_forget']
    assert invariant(leaked) and leaked.dropCalls == 0
    return ['shared_then_mutable_borrow', 'transfer_readopt_drop_once', 'forget_may_leak']

if __name__ == '__main__':
    result = {'scope': __doc__, 'controlsPassed':check_controls(), 'runs':[explore()]}
    assert result['runs'][0]['invariantHolds']
    for mutant in ['mutable_over_shared', 'into_raw_runs_drop', 'drop_with_live_handle']:
        row=explore(mutant); assert not row['invariantHolds']; result['runs'].append(row)
    print(json.dumps(result, indent=2))
