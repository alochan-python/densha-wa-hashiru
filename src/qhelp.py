Q = []
def MC(id, cat, rank, diff, q, ok, wrongs, expl, page, scene, reason, p=None, u=None, ch=None, rel=None, infer=False):
    Q.append(dict(id=id, cat=cat, rank=rank, diff=diff, type="mc", q=q, ok=ok, wrongs=wrongs, expl=expl,
                  page=page, scene=scene, reason=reason, p=p, u=u, ch=ch or [], rel=rel or [], infer=infer))
def SA(id, cat, rank, diff, q, model, keys, expl, page, scene, reason, p=None, u=None, ch=None, rel=None,
       limit=None, accept=None, kind="short", infer=False):
    Q.append(dict(id=id, cat=cat, rank=rank, diff=diff, type=kind, q=q, model=model, keys=keys or [], expl=expl,
                  page=page, scene=scene, reason=reason, p=p, u=u, ch=ch or [], rel=rel or [], limit=limit,
                  accept=accept or [], infer=infer))
def EX(id, cat, rank, diff, q, accept, expl, page, scene, reason, p=None, u=None, ch=None, rel=None, limit=None):
    SA(id, cat, rank, diff, q, accept[0], None, expl, page, scene, reason, p, u, ch, rel, limit, accept, "extract")
def WR(id, rank, diff, q, model, keys, expl, page, scene, reason, limit, p=None, u=None, ch=None, rel=None, infer=False):
    SA(id, "記述", rank, diff, q, model, keys, expl, page, scene, reason, p, u, ch, rel, limit, None, "write", infer)
