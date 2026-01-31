prompt manager功能
1. 功能和对话管理类似，文件夹结构，可拖拽，
第一排：可折叠，切换排序规则，批量操作（点击后有删除，移动到文件夹，没有tag），
第二排：可按标题搜索，没有tag筛选，有按类型筛选（system prompt，还是普通prompt），可以favorite筛选，交互和对话一样
第二排右边：创建文件夹，创建prompt
点击创建prompt，弹窗，一个表单，表单项有title，icon(这里看下可以怎么做，注意数据库的存储，这个icon会展时候在列表的标题左边), content，type，确定后会创建在当前选中的文件夹下（这个细节逻辑和tree一样）
不知道shadui有没有类似于antd的form组件，如果有的话可以用一下，减少代码量
以上没有提到的细节交互参考对话管理，因为交互逻辑基本一致
列表内容：
hover到每个entry上除了星星按钮还有个copy按钮，方便用户拷贝
右键entry菜单内容是（拷贝，添加到收藏|创建副本，删除），创建副本是创建一个一模一样的在当前文件夹，文件名prepend一个copy of
后端：包含表结构设计和crud的消息机制，也是参考folder和conversation，注意这个folder需要是一个新的folder表，和conversation的folder表区分开来

