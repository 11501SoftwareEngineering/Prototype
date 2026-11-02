import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

/*
 * variant / size 對照 Figma「Botton」元件的變體軸：
 *   Figma State=Default,  Color=Primary,   Style=Default -> variant="default"   (實心主色按鈕，例如「登入」)
 *   Figma State=Default,  Color=Secondary, Style=Default -> variant="secondary" (實心輔色按鈕，例如頁首「登入」導覽按鈕)
 *   Figma State=Default,  Color=Red,       Style=Default -> variant="destructive" (實心紅色按鈕，例如「刪除」)
 *   Figma Style=Text, Color=Primary                       -> variant="ghost"       (深色文字按鈕，例如「註冊」)
 *   Figma Style=Text, Color=Secondary                     -> variant="ghost-muted" (淺色文字按鈕，例如「隱私權」)
 *   Figma State=Hover 則交給瀏覽器原生的 :hover 處理，不用另外做一個 variant。
 *   Figma Size=Large -> size="lg"；Size=Small -> size="sm"（預設）。
 *   2026-10 依 Figma 元件頁（node 56:79）重新核對：hover 是疊 20% 黑色 → brightness-[0.8]；
 *   Large 內距是 16px（原本寫成 32px）；Small 有圖示時左右內距 8px。
 *   注意：Figma 按鈕的文字比一般網頁習慣大很多——Large 是 32px（設計稿裡叫 h1_title），
 *   Small 是 24px（設計稿裡叫 Header_text），不是網頁常見的 14-16px。
 *   這兩個字級已經改成用 tailwind.config.js 裡的 text-h1-title / text-header，
 *   不要因為「看起來很大」就自己改小，這是設計稿刻意的風格。
 * 按鈕文字用 --primary-foreground / --secondary-foreground（已在 main.css 設成深色 #4F595D），
 * 這是 Figma 特意設計成「淺色底 + 深色字」，不是白字，記得不要改回白色。
 *
 * 焦點外框說明：shadcn 產生的是 Tailwind v4 寫法 ring-3，但專案用 Tailwind v3（沒有 ring-3），
 * 原本鍵盤 Tab 到按鈕時完全看不到外框，所以改成 v3 也能用的 ring-[3px]。
 *
 * hover 顏色說明（這是修正過的地方）：
 * Figma 的 hover 是「底色 + 疊一層黑色 15% 透明度」，效果是讓顏色變暗、變濃。
 * 一開始寫成 hover:bg-primary/85（把按鈕底色本身變透明 85%），
 * 但按鈕外面是白色卡片，透明度一降低，白色會透出來，顏色反而變「淺」，跟 Figma 想要的「變暗」剛好相反。
 * 所以改成 hover:brightness-[0.8]，維持底色不透明，用亮度往下壓 20%，跟 Figma 疊 20% 黑色的效果一致。
 *
 * 邊框說明（這也是修正過的地方）：
 * Figma 查證後只有 Large 尺寸的實心按鈕才有 #EBE9E1 邊框，Small 尺寸完全沒有邊框。
 * 原本 border-border 是直接寫在 variant 裡、跟尺寸無關，導致 Small 按鈕也跟著長出邊框。
 * 改成 data-[size=lg]:border-border，只有在 size="lg" 時才會有邊框，Small 維持無邊框。
 */
export const buttonVariants = cva(
  'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive rounded-lg bg-clip-padding font-heading font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_img]:pointer-events-none [&_img]:shrink-0 [&_svg:not([class*=size-])]:size-6',
  {
    variants: {
      variant: {
        // Figma Color=Primary（主色 #8EB8B1）
        default:
          'bg-primary text-primary-foreground data-[size=lg]:border-border data-[size=lg]:shadow-elevated hover:brightness-[0.8]',
        // Figma Color=Secondary（輔色 #D4C9BA）
        secondary:
          'bg-secondary text-secondary-foreground data-[size=lg]:border-border data-[size=lg]:shadow-elevated hover:brightness-[0.8]',
        // Figma Color=Red（點綴色 #D29E97）：實心紅底 + 深色字，不是 shadcn 預設的淡紅底紅字。
        destructive:
          'bg-destructive text-foreground data-[size=lg]:border-border data-[size=lg]:shadow-elevated hover:brightness-[0.8] focus-visible:ring-destructive/40',
        // Figma Style=Text, Color=Primary：深色字，hover 變淺，按下變粗
        ghost: 'text-foreground hover:text-muted-foreground active:font-bold',
        // Figma Style=Text, Color=Secondary：淺色字，hover 變深，按下變粗
        'ghost-muted': 'text-muted-foreground hover:text-foreground active:font-bold',
        // 以下兩種 Figma 沒有，是 shadcn 內建的，盡量不要用
        outline: 'border-border bg-background hover:bg-muted hover:text-foreground shadow-xs',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Figma Size=Small：22px 字、上下 6px、左右 16px；有圖示時高 34px、左右 8px、間距 4px
        sm: 'px-4 py-1.5 text-header gap-1 has-[>svg]:h-[34px] has-[>svg]:px-2 has-[>img]:h-[34px] has-[>img]:px-2',
        // Figma Size=Large：32px 粗體字、高 62px、內距 16px，有外框和陰影
        // 只有 Large 有 1px 外框（Small 沒有，加了會讓按鈕每邊多 1px）；font-bold 對應 Figma 的 Bold 32px
        lg: 'h-[62px] p-4 text-h1-title font-bold gap-2 border border-transparent',
        // 以下尺寸 Figma 沒有，保留給 shadcn 內建元件（例如對話框的關閉鈕）使用
        default: 'h-9 gap-1.5 px-2.5 text-sm',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    compoundVariants: [
      // Figma Style=Text 的左右內距只有 4px
      {
        variant: ['ghost', 'ghost-muted'],
        size: 'sm',
        class: 'px-1 has-[>svg]:px-1 has-[>img]:px-1',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
