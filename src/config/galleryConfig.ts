import type { GalleryConfig } from "@/types/galleryConfig";

// 相册配置
export const galleryConfig: GalleryConfig = {
	// 相册列表
	albums: [
		// 支持jpg/png/webp/avif/gif格式
		// id: 相册唯一标识符（用于目录命名和URL路径），比如设置：id: "firefly-2026", 对应 public/gallery/firefly-2026/目录
		// cover: 手动指定封面图（可选，不填会把cover.*文件作为封面图，如果没有cover.*文件，则使用第一张图片作为封面图）
		// name: 相册名称
		// description: 相册描述
		// location: 相册拍摄地点
		// date: 相册日期，格式为 YYYY-MM-DD，用于排序和显示
		// tags: 相册标签，用于分类和过滤
		// password: 访问密码，设置后需要输入密码才能查看相册内容（可选）
		// passwordHint: 密码提示，设置后在输入密码错误时显示（可选，需配合password使用）
		// 每添加一个数组项就相当于添加了一个相册，记得在 public/gallery/ 目录下创建对应的子目录并放入图片
		{
			id: "cats",
			name: "猫猫!!!",
			description: "今天我要变成一个干瘪瘪的芝士球",
			location: "猫咖",
			date: "2026-06-12",
			tags: ["猫猫"],
		},
		{
			id: "shota",
			name: "美味正太",
			description:
				"老板，上菜，我要一个天然呆种的正太，一个无口面瘫正太，一个青梅正太，一个傲娇正太，一个弟弟系正太，一个爸爸系正太，一个宅男正太，一个辣妹正太，一个年上前辈正太，一个反差雌小鬼正太，一个财团大少爷正态，一个学霸正太，一个运动系黑皮正太，一对粘人兄弟正态，一个偶像正太，一个科研白大褂正太，一个地雷系正太，一个病娇正太，一个阴暗社恐正太，一个猫猫女仆装正太，一个管家正太，一个机男正太，一个伪娘正太，一个哥特正太，一个古装正太，一个旗袍正太，一个双肩包短裤白丝正太，一个重力系正太，一个病娇正太，一个文学眼镜正太，一个户外型正太。就这么多，先上菜！谢谢！！！",
			location: "X",
			date: "2026-09-09",
			tags: ["正太"],
			password: "2481374335qz",
			passwordHint: "你不可能不知道的,就是以前的密码,对,最简单的那一个",
		},
	],

	// 瀑布流最小列宽(px)，浏览器根据容器宽度自动计算列数，默认 240
	// 值越小列数越多，值越大列数越少
	columnWidth: 240,
};
