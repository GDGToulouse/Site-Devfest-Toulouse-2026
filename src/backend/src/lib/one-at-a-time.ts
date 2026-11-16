// Runs jobs one after another (#849): the badge PDF takes ten seconds or
// more and about 800 MB, so two at once doubled both, and the second request
// ran out the relay's time. A job that fails does not hold up the next one.
export function oneAtATime() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const run = tail.then(job, job);
    tail = run.catch(() => undefined);
    return run;
  };
}
