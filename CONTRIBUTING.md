# Работа с репозиторием

Конвенции для задач, веток, коммитов и PR. Процесс: обсуждение → issue → ветка → PR → ревью владельца → squash-мерж.

- Все GitHub-артефакты на английском: issues, ветки, коммиты, PR. Доки (`DOCUMENTATION.md`, `DECISIONS.md`) остаются на русском.
- Сначала issue: черновик показываю владельцу, создаю после «ок». Шаблоны - `.github/ISSUE_TEMPLATE/` (Task, Bug); метки `feature`, `bug`, `chore`, `docs`, `refactor`.
- Ветка от свежего `master`: `type/<issue>-short-slug` (`feat/12-todo-owner-index`).
- Коммиты - Conventional Commits: `type(scope): summary` (feat, fix, refactor, test, docs, chore, perf, ci, build), повелительное наклонение, до ~72 символов. Сгенерированное (миграции, lock-файл) и механическое (переименования, форматирование) - отдельными коммитами. Порядок коммитов - для чтения: schema/migration → core → tests → docs.
- PR: заголовок в формате Conventional Commit (при squash становится коммитом в `master`), `Closes #N`, шаблон `.github/pull_request_template.md` заполнен целиком: ручные действия перед мержем - в «Before merging», карта чтения файлов - в «Review guide», риски - в «Look closely at».
- Один PR - одна задача, без «заодно». Ориентир до ~300 строк без сгенерированного, больше - режем на несколько PR.
- PR открывается как draft, в «ready for review» - когда CI зелёный.
- Inline-комментарии самоаннотации - только для нетривиальной логики, 3-5 штук одним ревью; иначе хватает «Review guide».
- Замечания ревью - новыми коммитами, без force-push во время ревью.
- Мержит только владелец (squash, ветка удаляется автоматически). Агент не мержит никогда.
