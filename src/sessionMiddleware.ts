// import { Injectable } from '@angular/core'
import { distinctUntilChanged, map } from 'rxjs'
import { SessionMiddleware } from 'tabby-terminal'
import { Logger, ConfigService } from 'tabby-core'


// [dd/mm/yyyy hh:mm:ss:zzz]
// const DateOverhead = 26
const None = 'None'
const ISO = 'ISO 8601'
const Europe = 'dd/mm/yyyy hh:mm:ss.SSS'
const US = 'mm/dd/yyyy hh:mm:ss.SSS'
const SIMPLE = 'hh:mm:ss.SSS'

const OPEN_BRACKET = Buffer.from('[')
const CLOSE_BRACKET_SPACE = Buffer.from('] ')

// @Injectable()
export class SerialTimestampMiddleware extends SessionMiddleware {
    private logger: Logger
    private startOfLine: boolean
    private formatChanged: boolean
    private currentTimestampFormat: string

    constructor(
        private config: ConfigService,
        parentLogger: Logger
    ) {
        super()
        this.startOfLine = true
        this.formatChanged = false
        this.currentTimestampFormat = this.config.store.serialTimestampPlugin.timestamp

        this.config.changed$.pipe(
            map(() => this.config.store.serialTimestampPlugin.timestamp),
            distinctUntilChanged(),
        ).subscribe(() => this.updateTimestampFormat())

        this.logger = parentLogger
    }


    feedFromSession(data: Buffer): void {
        const currentDate = this.getDate()

        if (currentDate !== "") {
            const dataStr = data.toString('utf8')
            const lines = dataStr.split('\n')
            const dateBuffer = Buffer.from(currentDate)

            for (let i = 0; i < lines.length; i++) {
                const isLastLine = i === lines.length - 1
                let lineStr = lines[i]

                if (!isLastLine) {
                    lineStr += '\n'
                }

                if (lineStr.length === 0 && isLastLine) {
                    break
                }

                if (this.startOfLine || this.formatChanged) {
                    this.outputToTerminal.next(Buffer.concat([
                        OPEN_BRACKET,
                        dateBuffer,
                        CLOSE_BRACKET_SPACE,
                        Buffer.from(lineStr, 'utf8')
                    ]))
                    this.startOfLine = false
                    this.formatChanged = false
                } else {
                    this.outputToTerminal.next(Buffer.from(lineStr, 'utf8'))
                }

                if (lineStr.endsWith('\n') || lineStr.endsWith('\r')) {
                    this.startOfLine = true
                }
            }
        } else {
            this.outputToTerminal.next(data)
        }
    }

    close(): void {
        super.close()
    }

    private updateTimestampFormat() {
        this.currentTimestampFormat = this.config.store.serialTimestampPlugin.timestamp
        this.formatChanged = true
        this.logger.info(`Serial timestamp changed to ${this.currentTimestampFormat}`)
    }

    private getDate(): string {
        let date: Date

        switch (this.currentTimestampFormat) {
            case None:
                return ""
            case ISO:
                return new Date().toISOString()
            case Europe: {
                date = new Date()
                const day = date.getDate().toString().padStart(2, "0")
                const month = (date.getMonth() + 1).toString().padStart(2, "0")
                const year = date.getFullYear()
                const h = date.getHours().toString().padStart(2, "0")
                const m = date.getMinutes().toString().padStart(2, "0")
                const s = date.getSeconds().toString().padStart(2, "0")
                const ms = date.getMilliseconds().toString().padStart(3, "0")
                return `${day}/${month}/${year} ${h}:${m}:${s}.${ms}`
            }
            case US: {
                date = new Date()
                const day = date.getDate().toString().padStart(2, "0")
                const month = (date.getMonth() + 1).toString().padStart(2, "0")
                const year = date.getFullYear()
                const h = date.getHours().toString().padStart(2, "0")
                const m = date.getMinutes().toString().padStart(2, "0")
                const s = date.getSeconds().toString().padStart(2, "0")
                const ms = date.getMilliseconds().toString().padStart(3, "0")
                return `${month}/${day}/${year} ${h}:${m}:${s}.${ms}`
            }
            case SIMPLE: {
                date = new Date()
                const h = date.getHours().toString().padStart(2, "0")
                const m = date.getMinutes().toString().padStart(2, "0")
                const s = date.getSeconds().toString().padStart(2, "0")
                const ms = date.getMilliseconds().toString().padStart(3, "0")
                return `${h}:${m}:${s}.${ms}`
            }
            default:
                this.logger.error(`Unknown format ${this.currentTimestampFormat}`)
                return ""
        }
    }
}