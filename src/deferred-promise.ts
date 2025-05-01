type DeferredPromiseOptions<T> = {
    timeout?: number;
    onTimeout?: (resolve: (value: T) => void, reject: (reason: Error) => void) => void;
};

/** Creates a promise and exposes its resolve and reject methods, with an optional timeout. */
export class DeferredPromise<T> extends Promise<T> {
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
    private timeoutId?: NodeJS.Timeout;

    constructor(
        executor: (resolve: (value: T) => void, reject: (reason: Error) => void) => void,
        { timeout, onTimeout }: DeferredPromiseOptions<T> = {}
    ) {
        let resolveFn: (value: T) => void;
        let rejectFn: (reason?: unknown) => void;

        super((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.resolve = resolveFn!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.reject = rejectFn!;

        if (timeout !== undefined && onTimeout) {
            this.timeoutId = setTimeout(() => {
                onTimeout(this.resolve, this.reject);
            }, timeout);
        }

        executor(
            (value: T) => {
                if (this.timeoutId) clearTimeout(this.timeoutId);
                this.resolve(value);
            },
            (reason: Error) => {
                if (this.timeoutId) clearTimeout(this.timeoutId);
                this.reject(reason);
            }
        );
    }

    static fromPromise<T>(promise: Promise<T>, options: DeferredPromiseOptions<T> = {}): DeferredPromise<T> {
        return new DeferredPromise<T>((resolve, reject) => {
            promise
                .then((value) => {
                    resolve(value);
                })
                .catch((reason) => {
                    reject(reason as Error);
                });
        }, options);
    }
}
